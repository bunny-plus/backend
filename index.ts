import { Elysia } from "elysia";
import { Effect, Layer, ManagedRuntime } from "effect";
import { DiscordConfig, DatabaseConfig } from "./src/config/env.ts";
import { DiscordServiceLive } from "./src/services/discord.ts";
import { SessionServiceLive } from "./src/services/session.ts";
import { DatabaseLive } from "./src/db/client.ts";
import { createAuthRoutes } from "./src/routes/auth.ts";

const program = Effect.gen(function* () {
  const discordConfig = yield* DiscordConfig;
  const dbConfig = yield* DatabaseConfig;

  const AppLayer = Layer.provide(
    Layer.mergeAll(DiscordServiceLive(discordConfig), SessionServiceLive),
    DatabaseLive(dbConfig)
  );

  const runtime = ManagedRuntime.make(AppLayer);

  const app = new Elysia()
    .get("/", () => ({ message: "🐇" }))
    .use(createAuthRoutes(runtime))
    .listen(3001);

  console.log(`🐇 bunny.plus running at ${app.server?.hostname}:${app.server?.port}`);
});

Effect.runPromise(program).catch(console.error);
