try { process.loadEnvFile?.(); } catch (error) { if (error.code !== "ENOENT") throw error; }

import crypto from "node:crypto";
import { prisma } from "../src/lib.js";

const [emailArgument] = process.argv.slice(2);
const email = String(emailArgument || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:create -- your.personal@email.com");
  process.exitCode = 1;
} else {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(20);
  let bits = [...bytes].map((byte) => byte.toString(2).padStart(8, "0")).join("");
  let secret = "";
  for (let index = 0; index < bits.length; index += 5) secret += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  const user = await prisma.user.upsert({
    where: { email }, update: { role: "admin", active: true, totpSecret: secret },
    create: { email, role: "admin", active: true, totpSecret: secret },
  });
  console.log(`Admin ready: ${user.email}`);
  console.log(`TOTP secret: ${secret}`);
}
await prisma.$disconnect();
