try {
  process.loadEnvFile?.();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

import Fastify from "fastify";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST;
const listenOptions = host ? { port, host } : { port };

try {
  const { default: app } = await import("./app.js");
  await app.listen(listenOptions);
} catch (error) {
  console.error("PaperCall backend failed to initialize", error);

  const fallback = Fastify({ logger: true });
  fallback.get("/api/time", async () => ({
    now: new Date().toISOString(),
    ok: false,
  }));
  fallback.setNotFoundHandler(async (_request, reply) => {
    return reply.code(503).send({
      error: "Backend failed to initialize",
    });
  });
  await fallback.listen(listenOptions);
}
