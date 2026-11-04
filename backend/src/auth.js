import {
  AppError,
  badRequest,
  branches,
  forbidden,
  prisma,
  secureToken,
  sha256,
  timingSafeEqual,
  unauthorized,
  verifyTotp,
} from "./lib.js";

export async function createAppSession(accessToken, branch) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    throw new AppError(503, "Supabase Auth is not configured on the backend");
  }

  let identityResponse;
  try {
    identityResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError(502, "Could not verify your Supabase session");
  }

  if (!identityResponse.ok) throw unauthorized("Your sign-in session has expired. Please sign in again.");
  const identity = await identityResponse.json();
  const normalizedEmail = String(identity.email || "").trim().toLowerCase();
  const authUserId = String(identity.id || "");
  if (!normalizedEmail || !authUserId || !identity.email_confirmed_at) {
    throw unauthorized("Verify your personal email before continuing");
  }

  const normalizedBranch = branch ? String(branch).trim().toUpperCase() : null;
  if (normalizedBranch && !branches.has(normalizedBranch)) throw badRequest("Choose a valid branch");
  const user = await prisma.$transaction(async (tx) => {
    let account = await tx.user.findUnique({ where: { supabaseUserId: authUserId } });
    if (!account) account = await tx.user.findUnique({ where: { email: normalizedEmail } });
    if (!account && !normalizedBranch) return null;

    if (!account) {
      return tx.user.create({
        data: { email: normalizedEmail, supabaseUserId: authUserId, branch: normalizedBranch, active: true },
      });
    }

    if (account.supabaseUserId && account.supabaseUserId !== authUserId) {
      throw forbidden("This account is linked to a different sign-in identity");
    }

    return tx.user.update({
      where: { id: account.id },
      data: {
        supabaseUserId: authUserId,
        ...(!account.branch && normalizedBranch ? { branch: normalizedBranch } : {}),
      },
    });
  });

  if (!user) return { needsBranch: true };
  if (!user.active) throw forbidden("Account disabled");

  const token = secureToken();
  const session = await prisma.session.create({
    data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) },
  });
  return { token, userId: user.id, needsBranch: false, adminVerified: session.adminVerified };
}

export async function currentSession(request, db = prisma) {
  const token = request.cookies.session;
  if (!token) throw unauthorized("Login required");
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || !session.user.active || session.expiresAt <= new Date()) throw unauthorized("Session expired");
  return session;
}

export async function requireAdmin(request, db = prisma, requireSecondFactor = true) {
  const session = await currentSession(request, db);
  if (session.user.role !== "admin" || !session.user.active) throw forbidden("Admin access required");
  if (requireSecondFactor && !session.adminVerified) throw forbidden("Admin second factor required");
  return session;
}

export async function verifyAdminCode(request, code, pilotMode) {
  const session = await requireAdmin(request, prisma, false);
  if (pilotMode && process.env.PILOT_ADMIN_CODE) {
    if (!timingSafeEqual(code, process.env.PILOT_ADMIN_CODE)) throw forbidden("Invalid admin code");
  } else if (!session.user.totpSecret || !verifyTotp(session.user.totpSecret, code)) {
    throw forbidden("Invalid admin code");
  }
  await prisma.session.update({ where: { tokenHash: session.tokenHash }, data: { adminVerified: true } });
}

export function requireCsrf(request) {
  const cookie = request.cookies.csrf;
  const header = request.headers["x-csrf-token"];
  if (!cookie || !header || !timingSafeEqual(cookie, header)) throw forbidden("CSRF token required");
}

export function configureProduction(pilotMode) {
  if (process.env.APP_ENV !== "production") return;
  const required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"];
  if (pilotMode || process.env.PILOT_ADMIN_CODE || !required.every((key) => process.env[key])) {
    throw new AppError(500, "Production requires Supabase Auth configuration; pilot settings must be off");
  }
}
