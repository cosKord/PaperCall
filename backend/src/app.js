try { process.loadEnvFile?.(); } catch (error) { if (error.code !== "ENOENT") throw error; }

import fs from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { z } from "zod";
import {
  configureProduction, createAppSession, currentSession, requireAdmin, requireCsrf,
  verifyAdminCode,
} from "./auth.js";
import { addTopic, claimGrant, claimWelcomeGrant, createMarket, lockMarket, placeBet, publishMarket } from "./markets.js";
import { attachPaper, confirmSettlement, previewSettlement, settleConfirmed } from "./settlement.js";
import { createBranch, deleteBranch, renameBranch } from "./branches.js";
import { leaderboard, marketView, marketViews, profileView } from "./views.js";
import { AppError, badRequest, balance, loadBranches, notFound, prisma, secureToken, sha256 } from "./lib.js";

const pilotMode = process.env.PILOT_MODE === "1";
const app = Fastify({ logger: true, bodyLimit: 12 * 1024 * 1024 });
app.register(cookie);
app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 + 1 } });

const attempts = new Map();
const MAX_RATE_LIMIT_IDENTITIES = 10_000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;
let lastRateLimitCleanupAt = 0;

function pruneRateLimitAttempts(now) {
  if (attempts.size < MAX_RATE_LIMIT_IDENTITIES && now - lastRateLimitCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) return;

  for (const [identity, bucket] of attempts) {
    if (bucket.expiresAt <= now) attempts.delete(identity);
  }
  lastRateLimitCleanupAt = now;

  while (attempts.size >= MAX_RATE_LIMIT_IDENTITIES) {
    attempts.delete(attempts.keys().next().value);
  }
}

function limit(request, key, allowed, windowSeconds = 60) {
  const identity = `${key}:${request.ip}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  pruneRateLimitAttempts(now);
  const recent = (attempts.get(identity)?.timestamps || []).filter((time) => now - time < windowMs);
  if (recent.length >= allowed) throw new AppError(429, "Too many requests; try again later");
  recent.push(now);
  attempts.delete(identity);
  attempts.set(identity, { timestamps: recent, expiresAt: now + windowMs });
}

function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw badRequest(result.error.issues[0]?.message || "Invalid request");
  return result.data;
}

function integerParam(request, key) {
  const value = Number(request.params[key]);
  if (!Number.isInteger(value) || value <= 0) throw badRequest("Invalid ID");
  return value;
}

function mimeFor(filename) {
  const extension = path.extname(filename).toLowerCase();
  return ({ ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" })[extension] || "application/octet-stream";
}

async function sendFile(reply, filename, downloadName = null) {
  try {
    const content = await fs.readFile(filename);
    reply.type(mimeFor(filename));
    if (downloadName) reply.header("Content-Disposition", `inline; filename="${String(downloadName).replaceAll('"', '')}"`);
    return reply.send(content);
  } catch (error) {
    if (error.code === "ENOENT") throw notFound();
    throw error;
  }
}

app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) return reply.code(error.statusCode).send({ detail: error.message });
  if (error.code === "P2002") return reply.code(400).send({ detail: "That value is already in use" });
  if (error.code === "FST_REQ_FILE_TOO_LARGE") return reply.code(400).send({ detail: "Uploaded file is too large" });
  request.log.error(error);
  return reply.code(500).send({ detail: "Internal server error" });
});

app.addHook("onClose", async () => prisma.$disconnect());

const supabaseSessionInput = z.object({
  access_token: z.string().min(20).max(4096),
  branch: z.string().nullable().optional(),
});
const totpInput = z.object({ code: z.string().min(1) });
const profileInput = z.object({
  username: z.string().min(2).max(40), full_name: z.string().min(2).max(120),
  branch: z.string(), academic_year: z.string().min(1).max(30),
});
const marketInput = z.object({
  subject: z.string(), exam_type: z.string(), starts_at: z.string(), ends_at: z.string(),
  home_branches: z.array(z.string()), branch_starts: z.record(z.string(), z.string()),
  grant_pts: z.number().int().nullable().optional(), min_stake: z.number().int().default(1),
  away_min_stake: z.number().int().default(10),
});
const branchInput = z.object({
  name: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9 _-]*$/),
});

app.get("/", async () => ({ name: "ExamsMinigame API", ok: true }));

app.get("/api/time", async () => ({
  now: new Date().toISOString(),
  pilot_admin_code_enabled: Boolean(pilotMode && process.env.PILOT_ADMIN_CODE),
  admin_access_code_enabled: Boolean(process.env.APP_ENV === "production" && process.env.ADMIN_ACCESS_CODE),
}));

app.get("/api/branches", async () => {
  return loadBranches();
});

app.post("/api/auth/supabase-session", async (request, reply) => {
  configureProduction(pilotMode);
  limit(request, "supabase_session", 30, 60);
  const body = parse(supabaseSessionInput, request.body);
  const session = await createAppSession(body.access_token, body.branch);
  if (session.needsBranch) return { ok: true, needs_branch: true };
  const secure = !pilotMode;
  reply.setCookie("session", session.token, { httpOnly: true, secure, sameSite: "strict", maxAge: 7 * 86400, path: "/" });
  reply.setCookie("csrf", secureToken(24), { httpOnly: false, secure, sameSite: "strict", maxAge: 7 * 86400, path: "/" });
  return { ok: true, needs_branch: false, admin_verified: session.adminVerified };
});

app.post("/api/auth/admin-totp", async (request) => {
  configureProduction(pilotMode);
  requireCsrf(request);
  const { code } = parse(totpInput, request.body);
  limit(request, `admin_totp:${(request.cookies.session || "").slice(0, 12)}`, 5, 600);
  await verifyAdminCode(request, code, pilotMode);
  return { ok: true };
});

app.post("/api/auth/logout", async (request, reply) => {
  requireCsrf(request);
  if (request.cookies.session) await prisma.session.deleteMany({ where: { tokenHash: sha256(request.cookies.session) } });
  reply.clearCookie("session", { path: "/" });
  reply.clearCookie("csrf", { path: "/" });
  return { ok: true };
});

app.get("/api/me", async (request) => {
  const session = await currentSession(request);
  return {
    id: session.user.id, email: session.user.email,
    username: session.user.username || session.user.email.split("@", 1)[0], role: session.user.role,
    branch: session.user.branch, balance: await balance(prisma, session.userId),
    welcome_grant_available: session.user.role === "player" && !session.user.welcomeGrantClaimedAt,
    admin_verified: session.adminVerified,
  };
});

app.get("/api/profile", async (request) => profileView((await currentSession(request)).userId));

app.patch("/api/profile", async (request) => {
  requireCsrf(request);
  const session = await currentSession(request);
  const body = parse(profileInput, request.body);
  const branch = body.branch.trim().toUpperCase();
  const username = body.username.trim();
  const availableBranches = await loadBranches();
  if (!availableBranches.includes(branch)) throw badRequest("Choose a valid branch");
  if (session.user.branch && branch !== session.user.branch.trim().toUpperCase()) {
    throw badRequest("Your branch is locked after selection. Ask an admin to change it.");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(username)) throw badRequest("Username can use letters, numbers, hyphens and underscores");
  const taken = await prisma.user.findFirst({ where: { username, id: { not: session.userId } } });
  if (taken) throw badRequest("That username is already taken");
  await prisma.$transaction([
    prisma.user.update({ where: { id: session.userId }, data: { username, branch } }),
    prisma.profileDetail.upsert({
      where: { userId: session.userId },
      update: { fullName: body.full_name.trim(), academicYear: body.academic_year.trim(), updatedAt: new Date() },
      create: { userId: session.userId, fullName: body.full_name.trim(), academicYear: body.academic_year.trim() },
    }),
  ]);
  return profileView(session.userId);
});

app.post("/api/bug-reports", async (request) => {
  requireCsrf(request);
  const session = await currentSession(request);
  const { message } = parse(z.object({ message: z.string().min(3).max(2000) }), request.body);
  const report = await prisma.bugReport.create({ data: { userId: session.userId, message: message.trim() } });
  return { id: report.id, ok: true };
});

app.get("/api/markets", async (request) => {
  const session = await currentSession(request);
  const branch = request.query?.branch ? String(request.query.branch).trim().toUpperCase() : null;
  const includeTopics = String(request.query?.include_topics || "") === "1";
  const markets = await prisma.market.findMany({
    where: session.user.role === "admin" ? {} : { status: { not: "draft" }, legacy: false },
    orderBy: { id: "desc" },
  });
  const visibleMarkets = markets.filter((market) => !branch || (Array.isArray(market.homeBranches) && market.homeBranches.map(String).map((item) => item.toUpperCase()).includes(branch)));
  if (includeTopics) return marketViews(session.userId, visibleMarkets.map((market) => market.id));
  return visibleMarkets.map((market) => ({
    id: market.id, subject: market.subject, exam_type: market.examType, lockout_at: market.lockoutAt.toISOString(), status: market.status,
  }));
});

app.get("/api/markets/:marketId", async (request) => marketView((await currentSession(request)).userId, integerParam(request, "marketId")));

app.post("/api/markets/:marketId/claim-grant", async (request) => {
  requireCsrf(request);
  const session = await currentSession(request);
  const marketId = integerParam(request, "marketId");
  return { grant: await claimGrant(session.userId, marketId), balance: await balance(prisma, session.userId) };
});

app.post("/api/welcome-grant/claim", async (request) => {
  requireCsrf(request);
  const session = await currentSession(request);
  return claimWelcomeGrant(session.userId);
});

app.post("/api/bets", async (request) => {
  requireCsrf(request);
  const session = await currentSession(request);
  limit(request, `bet:${(request.cookies.session || "").slice(0, 12)}`, 30);
  const body = parse(z.object({ topic_id: z.number().int().positive(), side: z.enum(["hit", "miss"]), stake: z.number().int().positive() }), request.body);
  return placeBet(session.userId, body.topic_id, body.side, body.stake);
});

app.get("/api/leaderboard", async (request) => {
  const session = await currentSession(request);
  const marketId = request.query?.market_id ? Number(request.query.market_id) : null;
  const rows = await leaderboard(prisma, request.query?.scope || "season", marketId);
  return rows.map(({ userId, name, score }) => ({
    name,
    score,
    is_you: userId === session.userId,
  }));
});

app.post("/api/admin/markets", async (request) => {
  requireCsrf(request);
  const admin = await requireAdmin(request);
  return { id: await createMarket(admin.userId, parse(marketInput, request.body)) };
});

app.post("/api/admin/branches", async (request) => {
  requireCsrf(request);
  const admin = await requireAdmin(request);
  const { name } = parse(branchInput, request.body);
  return { name: await createBranch(admin.userId, name) };
});

app.patch("/api/admin/branches/:branch", async (request) => {
  requireCsrf(request);
  const admin = await requireAdmin(request);
  const { name } = parse(branchInput, request.body);
  return {
    name: await renameBranch(admin.userId, request.params.branch, name),
  };
});

app.delete("/api/admin/branches/:branch", async (request) => {
  requireCsrf(request);
  const admin = await requireAdmin(request);
  return deleteBranch(admin.userId, request.params.branch);
});

app.post("/api/admin/markets/:marketId/topics", async (request) => {
  requireCsrf(request);
  const admin = await requireAdmin(request);
  const body = parse(z.object({ title: z.string(), tier: z.enum(["low", "high"]) }), request.body);
  return { id: await addTopic(admin.userId, integerParam(request, "marketId"), body.title, body.tier) };
});

app.post("/api/admin/markets/:marketId/publish", async (request) => {
  requireCsrf(request); const admin = await requireAdmin(request);
  await publishMarket(admin.userId, integerParam(request, "marketId")); return { ok: true };
});

app.post("/api/admin/markets/:marketId/lock", async (request) => {
  requireCsrf(request); const admin = await requireAdmin(request);
  await lockMarket(admin.userId, integerParam(request, "marketId")); return { ok: true };
});

app.post("/api/admin/markets/:marketId/paper", async (request) => {
  requireCsrf(request); const admin = await requireAdmin(request);
  const file = await request.file(); if (!file) throw badRequest("Upload a question paper");
  const uploadDir = process.env.UPLOAD_DIR || path.resolve("..", "uploads");
  return attachPaper(admin.userId, integerParam(request, "marketId"), await file.toBuffer(), file.filename || "paper", uploadDir);
});

app.post("/api/admin/markets/:marketId/settlement-preview", async (request) => {
  requireCsrf(request); const admin = await requireAdmin(request);
  const { outcomes } = parse(z.object({ outcomes: z.record(z.string(), z.enum(["hit", "miss", "void"])) }), request.body);
  return previewSettlement(admin.userId, integerParam(request, "marketId"), outcomes);
});

app.post("/api/admin/markets/:marketId/settle", async (request) => {
  requireCsrf(request); const admin = await requireAdmin(request);
  const body = parse(z.object({ outcomes: z.record(z.string(), z.enum(["hit", "miss", "void"])).default({}), confirmed: z.boolean().default(false), digest: z.string().nullable().optional() }), request.body);
  const marketId = integerParam(request, "marketId");
  return body.digest ? confirmSettlement(admin.userId, marketId, body.digest) : settleConfirmed(admin.userId, marketId, body.outcomes, body.confirmed);
});

app.get("/api/admin/users", async (request) => {
  await requireAdmin(request);
  const branch = request.query?.branch ? String(request.query.branch).trim().toUpperCase() : null;
  const users = await prisma.user.findMany({ where: { role: "player", active: true, ...(branch ? { branch } : {}) }, orderBy: { createdAt: "desc" } });
  return users.map((user) => ({ id: user.id, email: user.email, username: user.username, branch: user.branch, active: user.active, created_at: user.createdAt.toISOString() }));
});

app.get("/api/admin/users/:userId/profile", async (request) => {
  await requireAdmin(request); const userId = integerParam(request, "userId");
  const user = await prisma.user.findFirst({ where: { id: userId, role: "player", active: true } });
  if (!user) throw badRequest("Active player not found");
  return profileView(userId);
});

app.post("/api/admin/users/:userId/balance-adjustments", async (request) => {
  requireCsrf(request); const admin = await requireAdmin(request); const userId = integerParam(request, "userId");
  const body = parse(z.object({ amount: z.number().int().min(-1000000).max(1000000).refine((value) => value !== 0, "Amount must not be zero"), reason: z.string().min(3).max(240) }), request.body);
  const player = await prisma.user.findFirst({ where: { id: userId, role: "player", active: true } });
  if (!player) throw badRequest("Active player not found");
  return prisma.$transaction(async (tx) => {
    await tx.ledger.create({ data: { userId, amount: body.amount, reason: "admin_adjustment" } });
    await tx.auditLog.create({ data: { actorId: admin.userId, action: "adjust_balance", detail: { user_id: userId, amount: body.amount, reason: body.reason.trim() } } });
    return { balance: await balance(tx, userId) };
  });
});

app.post("/api/admin/users/:userId/xp-adjustments", async (request) => {
  requireCsrf(request); const admin = await requireAdmin(request); const userId = integerParam(request, "userId");
  const body = parse(z.object({ xp: z.number().int().min(0).max(1000000), reason: z.string().min(3).max(240) }), request.body);
  const player = await prisma.user.findFirst({ where: { id: userId, role: "player", active: true } });
  if (!player) throw badRequest("Active player not found");
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { xp: body.xp } });
    await tx.auditLog.create({ data: { actorId: admin.userId, action: "set_xp", detail: { user_id: userId, previous_xp: player.xp, xp: body.xp, reason: body.reason.trim() } } });
    return { xp: body.xp };
  });
});

app.delete("/api/admin/users/:userId", async (request) => {
  requireCsrf(request); const admin = await requireAdmin(request); const userId = integerParam(request, "userId");
  const player = await prisma.user.findFirst({ where: { id: userId, role: "player", active: true } });
  if (!player) throw badRequest("Active player not found");
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { active: false } }),
    prisma.auditLog.create({ data: { actorId: admin.userId, action: "remove_player", detail: { user_id: userId, email: player.email } } }),
  ]);
  return { ok: true };
});

app.patch("/api/admin/users/:userId", async (request) => {
  requireCsrf(request); await requireAdmin(request); const userId = integerParam(request, "userId");
  const { active } = parse(z.object({ active: z.boolean() }), request.body);
  const changed = await prisma.user.updateMany({ where: { id: userId, role: "player" }, data: { active } });
  if (changed.count !== 1) throw badRequest("Player not found"); return { ok: true };
});

app.get("/api/markets/:marketId/paper", async (request, reply) => {
  await currentSession(request); const market = await prisma.market.findUnique({ where: { id: integerParam(request, "marketId") } });
  if (!market || market.status !== "settled" || !market.paperPath) throw notFound();
  return sendFile(reply, market.paperPath, path.basename(market.paperPath));
});

export default app;
