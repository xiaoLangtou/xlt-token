import type { FastifyError } from "fastify";
import { createApp } from "./app";
import { exampleConfig } from "./config";

async function main() {
  const { app } = await createApp();

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      console.error("[example] unhandled error:", error);
    }
    reply.status(statusCode).send({ error: error.message });
  });

  await app.listen({ port: exampleConfig.port, host: "0.0.0.0" });
  console.log(`[example] fastify listening on http://localhost:${exampleConfig.port}`);
  console.log("[example] try: curl -X POST http://localhost:3000/api/auth/login");
}

void main();
