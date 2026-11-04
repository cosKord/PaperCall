import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { badRequest, prisma, sha256 } from "./lib.js";

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function calculate(db, marketId, rawOutcomes) {
  const outcomes = Object.fromEntries(Object.entries(rawOutcomes || {}).map(([key, value]) => [String(key), value]));
  const topics = await db.topic.findMany({ where: { marketId }, orderBy: { id: "asc" }, include: { bets: { orderBy: { id: "asc" } } } });
  if (!topics.length || topics.some((topic) => !(String(topic.id) in outcomes)) || Object.keys(outcomes).length !== topics.length || Object.values(outcomes).some((value) => !["hit", "miss", "void"].includes(value))) {
    throw badRequest("Mark every topic hit, miss or void");
  }
  const payouts = {};
  for (const topic of topics) {
    const outcome = outcomes[String(topic.id)];
    const pool = topic.bets.reduce((sum, bet) => sum + bet.stake, 0);
    const winnerStakes = topic.bets.filter((bet) => bet.side === outcome).reduce((sum, bet) => sum + bet.stake, 0);
    for (const bet of topic.bets) {
      let amount = 0;
      let reason = "payout";
      if (outcome === "void" || winnerStakes === 0) {
        amount = bet.stake;
        reason = "refund";
      } else if (bet.side === outcome) {
        amount = Math.floor(pool * bet.stake / winnerStakes);
      }
      payouts[bet.id] = { amount, reason, user_id: bet.userId };
    }
  }
  return { outcomes, payouts };
}

function previewDigest(marketId, paperHash, outcomes, payouts) {
  return crypto.createHash("sha256").update(stableStringify({ market: marketId, paper: paperHash, outcomes, payouts })).digest("hex");
}

export async function attachPaper(adminId, marketId, buffer, filename, uploadDir) {
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market || market.status === "settled" || market.legacy) throw badRequest("Market cannot accept a paper");
  const pdf = buffer.subarray(0, 5).toString() === "%PDF-";
  const png = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (!buffer.length || buffer.length > 10 * 1024 * 1024 || (!pdf && !png && !jpeg)) throw badRequest("Upload a PDF, PNG or JPEG up to 10 MB");
  const suffix = pdf ? ".pdf" : png ? ".png" : ".jpg";
  const digest = sha256(buffer);
  await fs.mkdir(uploadDir, { recursive: true });
  const paperPath = path.join(uploadDir, `${marketId}-${digest}${suffix}`);
  await fs.writeFile(paperPath, buffer);
  await prisma.$transaction([
    prisma.market.update({ where: { id: marketId }, data: { paperPath, paperHash: digest } }),
    prisma.settlementPreview.deleteMany({ where: { marketId } }),
    prisma.auditLog.create({ data: { actorId: adminId, action: "attach_paper", detail: { market_id: marketId, hash: digest, filename } } }),
  ]);
  return { hash: digest, name: filename };
}

export async function previewSettlement(adminId, marketId, outcomes) {
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market || ["draft", "settled"].includes(market.status) || market.legacy || !market.paperHash || !market.endsAt || new Date() < market.endsAt) {
    throw badRequest("Wait for exam end and attach its question paper");
  }
  const calculated = await calculate(prisma, marketId, outcomes);
  const digest = previewDigest(marketId, market.paperHash, calculated.outcomes, calculated.payouts);
  await prisma.settlementPreview.upsert({
    where: { marketId },
    update: { digest, outcomes: calculated.outcomes, createdAt: new Date() },
    create: { marketId, digest, outcomes: calculated.outcomes },
  });
  return { digest, payout_total: Object.values(calculated.payouts).reduce((sum, item) => sum + item.amount, 0), payouts: calculated.payouts };
}

export async function confirmSettlement(adminId, marketId, digest) {
  return prisma.$transaction(async (tx) => {
    const market = await tx.market.findUnique({ where: { id: marketId } });
    if (!market) throw badRequest("Market not found");
    if (market.status === "settled") {
      const audit = await tx.auditLog.findFirst({ where: { action: "settle", detail: { path: ["digest"], equals: digest } } });
      if (!audit) throw badRequest("Market already settled with a different preview");
      const bets = await tx.bet.findMany({ where: { topic: { marketId } }, select: { payout: true } });
      return { payout_total: bets.reduce((sum, bet) => sum + bet.payout, 0), status: "settled" };
    }
    const preview = await tx.settlementPreview.findUnique({ where: { marketId } });
    if (!preview || preview.digest !== digest) throw badRequest("Preview changed; review payouts again");
    const calculated = await calculate(tx, marketId, preview.outcomes);
    const current = previewDigest(marketId, market.paperHash, calculated.outcomes, calculated.payouts);
    if (current !== digest) throw badRequest("Calls or paper changed; preview again");
    const now = new Date();
    for (const [topicId, outcome] of Object.entries(calculated.outcomes)) {
      await tx.topic.update({ where: { id: Number(topicId) }, data: { outcome } });
    }
    for (const [betId, payout] of Object.entries(calculated.payouts)) {
      await tx.bet.update({ where: { id: Number(betId) }, data: { payout: payout.amount } });
      if (payout.amount) {
        await tx.ledger.create({ data: { userId: payout.user_id, marketId, betId: Number(betId), amount: payout.amount, reason: payout.reason, createdAt: now } });
      }
    }
    const payoutTotal = Object.values(calculated.payouts).reduce((sum, item) => sum + item.amount, 0);
    await tx.market.update({ where: { id: marketId }, data: { status: "settled", settledAt: now } });
    await tx.auditLog.create({ data: { actorId: adminId, action: "settle", detail: { market_id: marketId, digest, payout_total: payoutTotal }, createdAt: now } });
    return { payout_total: payoutTotal, status: "settled" };
  }, { isolationLevel: "Serializable" });
}

export async function settleConfirmed(adminId, marketId, outcomes, confirmed) {
  if (confirmed !== true) throw badRequest("Confirm final settlement");
  const preview = await previewSettlement(adminId, marketId, outcomes);
  return confirmSettlement(adminId, marketId, preview.digest);
}
