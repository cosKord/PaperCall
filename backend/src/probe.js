import Fastify from "fastify";

const app = Fastify({ logger: true });
const modules = {
  app: () => import("./app.js"),
  auth: () => import("./auth.js"),
  branches: () => import("./branches.js"),
  lib: () => import("./lib.js"),
  markets: () => import("./markets.js"),
  settlement: () => import("./settlement.js"),
  views: () => import("./views.js"),
};

app.get("/api-diagnostic/time", async () => ({
  now: new Date().toISOString(),
  ok: true,
}));

app.get("/api-diagnostic/import/:module", async (request, reply) => {
  const load = modules[request.params.module];
  if (!load) return reply.code(404).send({ ok: false });

  try {
    await load();
    return { module: request.params.module, ok: true };
  } catch (error) {
    request.log.error(error, `Failed to import backend module: ${request.params.module}`);
    return reply.code(500).send({ module: request.params.module, ok: false });
  }
});

app.listen({ port: 3000 });
