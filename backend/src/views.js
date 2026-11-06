import { balance, badRequest, forbidden, marketPhase, prisma } from "./lib.js";

export async function leaderboard(db = prisma, scope = "season", marketId = null) {
  if (!new Set(["season", "market"]).has(scope) || (scope === "market" && !marketId)) {
    throw badRequest("Choose season or market scope");
  }
  const [users, scores] = await Promise.all([
    db.user.findMany({
      where: { role: "player", active: true },
      select: { id: true, email: true, username: true },
    }),
    db.bet.groupBy({
      by: ["userId"],
      where: {
        topic: {
          market: {
            status: "settled",
            ...(scope === "market" ? { id: marketId } : {}),
          },
        },
      },
      _sum: { payout: true, stake: true },
    }),
  ]);
  const scoreByUser = new Map(
    scores.map(({ userId, _sum }) => [
      userId,
      (_sum.payout ?? 0) - (_sum.stake ?? 0),
    ]),
  );
  const rows = users.flatMap((user) => {
    const score = scoreByUser.get(user.id);
    if (score === undefined) return [];
    const at = user.email.indexOf("@");
    const fallbackName = at > 0 ? `${user.email[0]}•••${user.email.slice(at)}` : "Player";
    return [{ userId: user.id, name: user.username || fallbackName, score }];
  });
  return rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export async function marketView(userId, marketId, db = prisma) {
  const [market, user] = await Promise.all([
    db.market.findUnique({
      where: { id: marketId },
      include: { topics: { orderBy: { id: "asc" }, include: { bets: true } } },
    }),
    db.user.findUnique({ where: { id: userId } }),
  ]);
  if (!market) throw badRequest("Market not found");
  if (user.role !== "admin" && (market.status === "draft" || market.legacy)) throw forbidden("Market unavailable");
  const currentBalance = await balance(db, userId);
  const result = {
    id: market.id,
    subject: market.subject,
    exam_type: market.examType,
    starts_at: market.startsAt.toISOString(),
    ends_at: market.endsAt?.toISOString() || null,
    lockout_at: market.lockoutAt.toISOString(),
    status: marketPhase(market),
    grant_pts: market.grantPts,
    legacy: market.legacy,
    topics: [],
  };
  if (market.status === "settled") result.paper_available = Boolean(market.paperPath);
  for (const topic of market.topics) {
    const item = { id: topic.id, title: topic.title, tier: topic.tier, max_stake: currentBalance };
    const own = topic.bets.find((bet) => bet.userId === userId);
    if (own) {
      item.my_bet = { side: own.side, stake: own.stake };
      if (market.status === "settled") Object.assign(item.my_bet, { payout: own.payout, net: own.payout - own.stake });
    }
    item.pool = {
      hit: topic.bets.filter((bet) => bet.side === "hit").reduce((sum, bet) => sum + bet.stake, 0),
      miss: topic.bets.filter((bet) => bet.side === "miss").reduce((sum, bet) => sum + bet.stake, 0),
    };
    if (market.status === "settled") item.outcome = topic.outcome;
    result.topics.push(item);
  }
  return result;
}

export async function marketViews(userId, marketIds, db = prisma) {
  return Promise.all(marketIds.map((marketId) => marketView(userId, marketId, db)));
}

export async function profileView(userId, db = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      bets: { orderBy: { id: "desc" }, include: { topic: { include: { market: true } } } },
    },
  });
  if (!user) throw badRequest("User not found");
  const settled = user.bets.filter((bet) => bet.topic.market.status === "settled");
  const active = user.bets.filter((bet) => bet.topic.market.status !== "settled");
  const scored = settled.filter((bet) => bet.topic.outcome !== "void");
  const rankings = await leaderboard(db);
  const rank = rankings.findIndex((row) => row.userId === user.id) + 1;
  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username || user.email.split("@", 1)[0],
      full_name: user.profile?.fullName || null,
      academic_year: user.profile?.academicYear || null,
      branch: user.branch,
      balance: await balance(db, user.id),
      xp: user.xp,
    },
    score: settled.reduce((sum, bet) => sum + bet.payout - bet.stake, 0),
    rank,
    prediction_count: user.bets.length,
    subject_count: new Set(user.bets.map((bet) => bet.topic.marketId)).size,
    success_rate: scored.length ? Math.round(100 * scored.filter((bet) => bet.side === bet.topic.outcome).length / scored.length) : 0,
    active_bets: active.map((bet) => ({
      market_id: bet.topic.marketId, subject: bet.topic.market.subject, exam_type: bet.topic.market.examType, topic_id: bet.topicId,
      topic: bet.topic.title, side: bet.side, stake: bet.stake,
    })),
    settled_bets: settled.map((bet) => ({
      market_id: bet.topic.marketId, subject: bet.topic.market.subject, exam_type: bet.topic.market.examType, topic_id: bet.topicId,
      topic: bet.topic.title, side: bet.side, stake: bet.stake, payout: bet.payout,
      net: bet.payout - bet.stake, outcome: bet.topic.outcome,
      settled_at: bet.topic.market.settledAt?.toISOString() || null,
    })),
  };
}
