import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Effect, Layer, ManagedRuntime } from "effect";
import { DiscordConfig, DatabaseConfig, AppConfig } from "./src/config/env.ts";
import { DiscordServiceLive } from "./src/services/discord.ts";
import { SessionServiceLive } from "./src/services/session.ts";
import { UserServiceLive } from "./src/services/user.ts";
import { CardServiceLive } from "./src/services/card.ts";
import { RealtimeServiceLive } from "./src/services/realtime.ts";
import { DatabaseLive } from "./src/db/client.ts";
import { createAuthRoutes } from "./src/routes/auth.ts";
import { createApiRoutes } from "./src/routes/api.ts";
import { createRealtimeRoutes } from "./src/routes/realtime.ts";

const program = Effect.gen(function* () {
  const discordConfig = yield* DiscordConfig;
  const dbConfig = yield* DatabaseConfig;
  const appConfig = yield* AppConfig;

  const AppLayer = Layer.provide(
    Layer.mergeAll(
      DiscordServiceLive(discordConfig),
      SessionServiceLive,
      UserServiceLive,
      CardServiceLive,
      RealtimeServiceLive,
    ),
    DatabaseLive(dbConfig),
  );

  const runtime = ManagedRuntime.make(AppLayer);

  const app = new Elysia()
    .use(
      cors({
        origin: true,
        credentials: true,
        allowedHeaders: ["Content-Type"],
        methods: ["GET", "POST", "OPTIONS"],
      }),
    )
    .get("/", () => ({ message: "🐇" }))
    .use(createAuthRoutes(runtime, appConfig.frontendUrl, discordConfig.requiredGuildId))
    .use(createApiRoutes(runtime))
    .use(createRealtimeRoutes(runtime))
    .listen(3001);

  console.log(`🐇 bunny.plus running at ${app.server?.hostname}:${app.server?.port}`);
});

Effect.runPromise(program).catch(console.error);
