import { Elysia } from "elysia";
import { Effect, ManagedRuntime } from "effect";
import { DiscordService } from "../services/discord.ts";
import { SessionService } from "../services/session.ts";

export const createAuthRoutes = (
  runtime: ManagedRuntime.ManagedRuntime<DiscordService | SessionService, never>,
  frontendUrl: string,
) =>
  new Elysia({ prefix: "/auth" })
    .get("/discord", async ({ set }) => {
      const state = crypto.randomUUID();

      const program = DiscordService.pipe(Effect.flatMap((service) => service.getAuthUrl(state)));

      const authUrl = await runtime.runPromise(program);

      set.status = 302;
      set.headers["Location"] = authUrl;
      return;
    })
    .get("/callback", async ({ query, set }) => {
      const { code, state } = query;

      if (typeof code !== "string" || code.length === 0) {
        set.status = 400;
        return { error: "Missing authorization code" };
      }

      const program = Effect.gen(function* () {
        const discord = yield* DiscordService;
        const sessionService = yield* SessionService;

        const tokenResponse = yield* discord.exchangeCode(code);
        const user = yield* discord.getUser(tokenResponse.access_token);

        const session = yield* sessionService.create(user.id, user.global_name ?? user.username);

        return {
          session,
          user,
        };
      });

      const result = await runtime.runPromise(program);

      set.status = 302;
      set.headers["Location"] = frontendUrl;
      set.headers["Set-Cookie"] =
        `session_id=${result.session.id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`;

      return;
    });
