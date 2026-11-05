import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/api-diagnostic/time", async () => ({
  now: new Date().toISOString(),
  ok: true,
}));

app.listen({ port: 3000 });
