import { badRequest, balance, branches, marketPhase, prisma } from "./lib.js";

export async function createMarket(adminId, body) {
  const subject = String(body.subject || "").trim();
  const startsAt = new Date(body.starts_at);
  const endsAt = new Date(body.ends_at);
  const homeBranches = Array.from(
    new Set((body.home_branches || []).map((item) => String(item).trim().toUpperCase())),
  );
  const branchStarts = body.branch_starts || {};
  if (!subject || !["midsem", "endsem", "other"].includes(body.exam_type) || Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt || !homeBranches.length) {
    throw badRequest("Invalid market details");
  }
  if (homeBranches.some((branch) => !branches.has(branch) || !branchStarts[branch])) {
    throw badRequest("Every home branch needs an exam schedule");
  }
  const schedules = Object.entries(branchStarts).map(([branch, value]) => ({ branch: branch.trim().toUpperCase(), startsAt: new Date(value) }));
  if (schedules.some(({ branch, startsAt: value }) => !branch || Number.isNaN(value.valueOf()))) throw badRequest("Every home branch needs an exam schedule");
  const firstStart = new Date(Math.min(...schedules.map(({ startsAt: value }) => value.valueOf())));
  const lastStart = new Date(Math.max(...schedules.map(({ startsAt: value }) => value.valueOf())));
  if (endsAt <= lastStart) throw badRequest("Exam end must follow every branch start");
  if (firstStart < startsAt || firstStart <= new Date()) throw badRequest("Branch exam starts must be in the future");
  const grantPts = body.grant_pts ?? ({ midsem: 100, endsem: 150, other: 100 })[body.exam_type];
  const minStake = body.min_stake ?? 1;
  const awayMinStake = body.away_min_stake ?? 10;
  const lowCapPct = body.low_cap_pct ?? 20;
  const highCapPct = body.high_cap_pct ?? 40;
  if (!(minStake > 0 && minStake <= awayMinStake && awayMinStake <= grantPts) || ![lowCapPct, highCapPct].every((value) => value >= 1 && value <= 100)) {
    throw badRequest("Invalid stake or grant rules");
  }
  return prisma.$transaction(async (tx) => {
    const market = await tx.market.create({
      data: {
        subject, examType: body.exam_type, startsAt, endsAt, lockoutAt: firstStart, grantPts,
        homeBranches, minStake, awayMinStake, lowCapPct, highCapPct, status: "draft",
        branchExams: { create: schedules },
      },
    });
    await tx.auditLog.create({ data: { actorId: adminId, action: "create_market", detail: { market_id: market.id } } });
    return market.id;
  });
}

export async function addTopic(adminId, marketId, title, tier) {
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market || market.status !== "draft" || !["low", "high"].includes(tier) || !String(title || "").trim()) {
    throw badRequest("Draft market and valid topic required");
  }
  const topic = await prisma.topic.create({ data: { marketId, title: title.trim(), tier } });
  return topic.id;
}

export async function publishMarket(adminId, marketId) {
  return prisma.$transaction(async (tx) => {
    const topics = await tx.topic.count({ where: { marketId } });
    if (!topics) throw badRequest("Add a topic first");
    const changed = await tx.market.updateMany({ where: { id: marketId, status: "draft" }, data: { status: "open" } });
    if (changed.count !== 1) throw badRequest("Only draft markets can be published");
    await tx.auditLog.create({ data: { actorId: adminId, action: "publish_market", detail: { market_id: marketId } } });
  });
}

export async function lockMarket(adminId, marketId) {
  return prisma.$transaction(async (tx) => {
    const market = await tx.market.findUnique({ where: { id: marketId } });
    if (!market || marketPhase(market) !== "open") throw badRequest("Only open markets can be locked");
    const now = new Date();
    await tx.market.update({ where: { id: marketId }, data: { lockoutAt: now } });
    await tx.auditLog.create({ data: { actorId: adminId, action: "lock_market", detail: { market_id: marketId }, createdAt: now } });
  });
}

export async function claimGrant(userId, marketId) {
  return prisma.$transaction(async (tx) => {
    const [user, market, existing] = await Promise.all([
      tx.user.findUnique({ where: { id: userId } }),
      tx.market.findUnique({ where: { id: marketId }, include: { branchExams: true } }),
      tx.grantClaim.findUnique({ where: { userId_marketId: { userId, marketId } } }),
    ]);
    if (!user?.active || !user.branch || !market || market.legacy) throw badRequest("Grant unavailable");
    if (existing) return market.grantPts;
    if (marketPhase(market) !== "open" || !market.branchExams.some((exam) => exam.branch === user.branch)) throw badRequest("Grant unavailable");
    await tx.grantClaim.create({ data: { userId, marketId } });
    await tx.ledger.create({ data: { userId, marketId, amount: market.grantPts, reason: "grant" } });
    return market.grantPts;
  });
}

export async function claimWelcomeGrant(userId) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user?.active || user.role !== "player") throw badRequest("Welcome grant unavailable");

    const now = new Date();
    const claim = await tx.user.updateMany({
      where: { id: userId, welcomeGrantClaimedAt: null },
      data: { welcomeGrantClaimedAt: now },
    });
    if (!claim.count) {
      return { granted: false, amount: 0, balance: await balance(tx, userId) };
    }

    await tx.ledger.create({
      data: { userId, amount: 1000, reason: "welcome_grant", createdAt: now },
    });
    return { granted: true, amount: 1000, balance: await balance(tx, userId) };
  });
}

export async function placeBet(userId, topicId, side, stake) {
  if (!Number.isInteger(stake) || stake <= 0 || !["hit", "miss"].includes(side)) throw badRequest("Choose hit/miss and a positive whole-point stake");
  return prisma.$transaction(async (tx) => {
    const [user, topic] = await Promise.all([
      tx.user.findUnique({ where: { id: userId } }),
      tx.topic.findUnique({ where: { id: topicId }, include: { market: { include: { branchExams: true } } } }),
    ]);
    if (!user?.active || user.role !== "player" || !user.branch || !topic) throw badRequest("Verified player and topic required");
    const market = topic.market;
    const now = new Date();
    if (marketPhase(market, now) !== "open" || now >= market.lockoutAt) throw badRequest("Calls are closed");
    const branchExam = market.branchExams.find((exam) => exam.branch === user.branch);
    if (branchExam && now >= branchExam.startsAt) throw badRequest("Your branch has already written this exam");
    const existing = await tx.bet.findUnique({ where: { userId_topicId: { userId, topicId } } });
    if (existing) throw badRequest("One final call per topic");
    const available = await balance(tx, userId);
    const homeBranches = Array.isArray(market.homeBranches) ? market.homeBranches : [];
    const minimum = homeBranches.includes(user.branch) ? market.minStake : market.awayMinStake;
    if (stake < minimum || stake > available) throw badRequest(`Stake must be between ${minimum} and ${available} points`);
    const bet = await tx.bet.create({ data: { userId, topicId, side, stake } });
    await tx.ledger.create({ data: { userId, marketId: market.id, betId: bet.id, amount: -stake, reason: "bet", createdAt: now } });
    return { id: bet.id, receipt_time: now.toISOString(), balance: await balance(tx, userId) };
  });
}
