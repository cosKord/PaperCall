import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
export const branches = new Set(["IT", "CSE", "AIDS", "CSBS", "MECH", "CCE"]);

let branchesLoaded = false;
let branchesLoading;

export async function loadBranches(db = prisma) {
  if (branchesLoaded) return [...branches].sort((left, right) => left.localeCompare(right));
  if (!branchesLoading) {
    branchesLoading = db.branch.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }).then((rows) => {
      branches.clear();
      for (const branch of rows) branches.add(branch.name);
      branchesLoaded = true;
      return rows.map((branch) => branch.name);
    }).finally(() => {
      branchesLoading = undefined;
    });
  }
  return branchesLoading;
}

export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const badRequest = (message) => new AppError(400, message);
export const forbidden = (message) => new AppError(403, message);
export const unauthorized = (message) => new AppError(401, message);
export const notFound = (message = "Not found") => new AppError(404, message);
export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
export const secureToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const timingSafeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export async function balance(db, userId) {
  const result = await db.ledger.aggregate({ where: { userId }, _sum: { amount: true } });
  return result._sum.amount || 0;
}

export function marketPhase(market, at = new Date()) {
  if (market.status === "draft" || market.status === "settled") return market.status;
  return at >= market.lockoutAt ? "closed" : "open";
}

export function verifyTotp(secret, code, window = 1) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) return false;
    bits += index.toString(2).padStart(5, "0");
  }
  const key = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < key.length; i += 1) key[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const step = Math.floor(Date.now() / 30000);
  for (let offset = -window; offset <= window; offset += 1) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step + offset));
    const digest = crypto.createHmac("sha1", key).update(counter).digest();
    const position = digest[digest.length - 1] & 15;
    const value = (digest.readUInt32BE(position) & 0x7fffffff) % 1000000;
    if (timingSafeEqual(String(code), String(value).padStart(6, "0"))) return true;
  }
  return false;
}

export function serialize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}
