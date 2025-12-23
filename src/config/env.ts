import { Config } from "effect";

export const DiscordClientId = Config.string("DISCORD_CLIENT_ID");
export const DiscordClientSecret = Config.string("DISCORD_CLIENT_SECRET");
export const DiscordRedirectUri = Config.string("DISCORD_REDIRECT_URI");
export const AppUrl = Config.withDefault(Config.string("APP_URL"), "http://localhost:3000");

export const DiscordConfig = Config.all({
  clientId: DiscordClientId,
  clientSecret: DiscordClientSecret,
  redirectUri: DiscordRedirectUri,
  appUrl: AppUrl,
});

export type DiscordConfig = Config.Config.Success<typeof DiscordConfig>;

export const DatabaseUrl = Config.string("DATABASE_URL");

export const DatabaseConfig = Config.all({
  url: DatabaseUrl,
});

export type DatabaseConfig = Config.Config.Success<typeof DatabaseConfig>;
