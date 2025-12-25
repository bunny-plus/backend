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

      console.log("[Auth] Callback received", { hasCode: !!code, state });

      if (typeof code !== "string" || code.length === 0) {
        console.error("[Auth] Missing authorization code");
        set.status = 400;
        return { error: "Missing authorization code" };
      }

      const program = Effect.gen(function* () {
        const discord = yield* DiscordService;
        const sessionService = yield* SessionService;
        const userService = yield* UserService;

        console.log("[Auth] Exchanging code for token");
        const tokenResponse = yield* discord.exchangeCode(code);

        console.log("[Auth] Fetching Discord user");
        const discordUser = yield* discord.getUser(tokenResponse.access_token);
        console.log("[Auth] User:", { id: discordUser.id, username: discordUser.username });

        console.log("[Auth] Fetching user guilds");
        const guilds = yield* discord.getUserGuilds(tokenResponse.access_token);
        console.log(
          "[Auth] User is in guilds:",
          guilds.map((g) => ({ id: g.id, name: g.name })),
        );
        console.log("[Auth] Required guild ID:", requiredGuildId);

        const isInRequiredGuild = guilds.some((guild) => guild.id === requiredGuildId);
        console.log("[Auth] Is in required guild:", isInRequiredGuild);

        if (!isInRequiredGuild) {
          console.error("[Auth] User not in required guild");
          yield* Effect.fail({
            _tag: "Unauthorized" as const,
            message:
              "You must be a member of the required Discord server to access this application.",
          });
        }

        console.log("[Auth] Upserting user");
        const user = yield* userService.upsert(
          discordUser.id,
          discordUser.global_name ?? discordUser.username,
          discordUser.avatar,
        );

        console.log("[Auth] Creating session");
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

      console.log("[Auth] Authentication successful, redirecting to frontend");
      set.status = 302;
      set.headers["Location"] = frontendUrl;
      set.headers["Set-Cookie"] =
        `session_id=${result.value.session.id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`;

      return;
    });
