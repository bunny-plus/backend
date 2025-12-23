import { Context, Effect, Layer } from "effect";
import type { DiscordConfig } from "../config/env.ts";

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

function isDiscordTokenResponse(data: unknown): data is DiscordTokenResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "access_token" in data &&
    typeof data.access_token === "string" &&
    "token_type" in data &&
    typeof data.token_type === "string"
  );
}

function isDiscordUser(data: unknown): data is DiscordUser {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof data.id === "string" &&
    "username" in data &&
    typeof data.username === "string"
  );
}

export class DiscordOAuthError {
  readonly _tag = "DiscordOAuthError";
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

export class DiscordService extends Context.Tag("DiscordService")<
  DiscordService,
  {
    readonly getAuthUrl: (state: string) => Effect.Effect<string>;
    readonly exchangeCode: (code: string) => Effect.Effect<DiscordTokenResponse, DiscordOAuthError>;
    readonly getUser: (accessToken: string) => Effect.Effect<DiscordUser, DiscordOAuthError>;
  }
>() {}

export const DiscordServiceLive = (config: DiscordConfig) =>
  Layer.succeed(
    DiscordService,
    DiscordService.of({
      getAuthUrl: (state: string) =>
        Effect.sync(() => {
          const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: "code",
            scope: "identify",
            state,
          });
          return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
        }),

      exchangeCode: (code: string) =>
        Effect.tryPromise({
          try: async () => {
            const params = new URLSearchParams({
              client_id: config.clientId,
              client_secret: config.clientSecret,
              grant_type: "authorization_code",
              code,
              redirect_uri: config.redirectUri,
            });

            const response = await fetch("https://discord.com/api/oauth2/token", {
              method: "POST",
              body: params,
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            });

            if (!response.ok) {
              const error = await response.text();
              throw new Error(`Discord token exchange failed: ${error}`);
            }

            const data: unknown = await response.json();
            if (!isDiscordTokenResponse(data)) {
              throw new Error("Invalid token response from Discord");
            }
            return data;
          },
          catch: (error) => new DiscordOAuthError("Failed to exchange code for token", error),
        }),

      getUser: (accessToken: string) =>
        Effect.tryPromise({
          try: async () => {
            const response = await fetch("https://discord.com/api/users/@me", {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (!response.ok) {
              const error = await response.text();
              throw new Error(`Discord user fetch failed: ${error}`);
            }

            const data: unknown = await response.json();
            if (!isDiscordUser(data)) {
              throw new Error("Invalid user response from Discord");
            }
            return data;
          },
          catch: (error) => new DiscordOAuthError("Failed to fetch user", error),
        }),
    }),
  );
