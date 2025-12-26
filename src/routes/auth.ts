import { Elysia } from "elysia";
import { Effect, ManagedRuntime } from "effect";
import { DiscordService } from "../services/discord.ts";
import { SessionService } from "../services/session.ts";
import { UserService } from "../services/user.ts";

export const createAuthRoutes = (
  runtime: ManagedRuntime.ManagedRuntime<DiscordService | SessionService | UserService, never>,
  frontendUrl: string,
  requiredGuildId: string,
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
        console.error("[Auth] Missing authorization code");
        set.status = 400;
        return { error: "Missing authorization code" };
      }

      const program = Effect.gen(function* () {
        const discord = yield* DiscordService;
        const sessionService = yield* SessionService;
        const userService = yield* UserService;

        const tokenResponse = yield* discord.exchangeCode(code);
        const discordUser = yield* discord.getUser(tokenResponse.access_token);
        const guilds = yield* discord.getUserGuilds(tokenResponse.access_token);

        const isInRequiredGuild = guilds.some((guild) => guild.id === requiredGuildId);

        if (!isInRequiredGuild) {
          console.error("[Auth] User not in required guild");
          yield* Effect.fail({
            _tag: "Unauthorized" as const,
            message:
              "You must be a member of the required Discord server to access this application.",
          });
        }

        const user = yield* userService.upsert(
          discordUser.id,
          discordUser.global_name ?? discordUser.username,
          discordUser.avatar,
        );

        const session = yield* sessionService.create(user.discordId);

        return {
          session,
          user,
        };
      });

      const result = await runtime.runPromiseExit(program);

      if (result._tag === "Failure") {
        console.error("[Auth] Authentication failed:", result.cause);
        set.status = 302;
        set.headers["Location"] = `${frontendUrl}?error=unauthorized`;
        return;
      }

      set.status = 302;
      set.headers["Location"] = frontendUrl;
      set.headers["Set-Cookie"] =
        `session_id=${result.value.session.id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`;

      return;
    });
