import { badRequest, notFound, prisma } from "./lib.js";

export function normalizeBranch(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function validateBranchName(value) {
  const name = normalizeBranch(value);
  if (!/^[A-Z0-9][A-Z0-9 _-]{1,39}$/.test(name)) {
    throw badRequest("Room name must be 2–40 letters, numbers, spaces, hyphens or underscores");
  }
  return name;
}

export async function createBranch(adminId, rawName) {
  const name = validateBranchName(rawName);
  await prisma.$transaction(async (tx) => {
    await tx.branch.create({ data: { name } });
    await tx.auditLog.create({
      data: { actorId: adminId, action: "create_branch", detail: { branch: name } },
    });
  });
  return name;
}

export async function renameBranch(adminId, rawCurrentName, rawNextName) {
  const currentName = normalizeBranch(rawCurrentName);
  const nextName = validateBranchName(rawNextName);
  if (currentName === nextName) return nextName;

  await prisma.$transaction(async (tx) => {
    const current = await tx.branch.findUnique({ where: { name: currentName } });
    if (!current) throw notFound("Room not found");
    if (await tx.branch.findUnique({ where: { name: nextName } })) {
      throw badRequest("A room with that name already exists");
    }

    const markets = await tx.market.findMany({
      select: { id: true, homeBranches: true },
    });
    for (const market of markets) {
      const homeBranches = Array.isArray(market.homeBranches)
        ? market.homeBranches.map(String)
        : [];
      if (homeBranches.includes(currentName)) {
        await tx.market.update({
          where: { id: market.id },
          data: {
            homeBranches: homeBranches.map((branch) =>
              branch === currentName ? nextName : branch,
            ),
          },
        });
      }
    }

    await tx.user.updateMany({
      where: { branch: currentName },
      data: { branch: nextName },
    });
    await tx.branchExam.updateMany({
      where: { branch: currentName },
      data: { branch: nextName },
    });
    await tx.branch.update({
      where: { name: currentName },
      data: { name: nextName },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "rename_branch",
        detail: { from: currentName, to: nextName },
      },
    });
  });

  return nextName;
}

export async function deleteBranch(adminId, rawName) {
  const name = normalizeBranch(rawName);

  await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { name } });
    if (!branch) throw notFound("Room not found");

    const [players, scheduledExams, markets] = await Promise.all([
      tx.user.count({ where: { branch: name } }),
      tx.branchExam.count({ where: { branch: name } }),
      tx.market.findMany({ select: { homeBranches: true } }),
    ]);
    const appearsOnMarket = markets.some(
      (market) =>
        Array.isArray(market.homeBranches) &&
        market.homeBranches.map(String).includes(name),
    );

    if (players || scheduledExams || appearsOnMarket) {
      throw badRequest(
        "This room still has players or exam history. Rename it or clear those references before deleting it.",
      );
    }

    await tx.branch.delete({ where: { name } });
    await tx.auditLog.create({
      data: { actorId: adminId, action: "delete_branch", detail: { branch: name } },
    });
  });

  return { ok: true };
}
