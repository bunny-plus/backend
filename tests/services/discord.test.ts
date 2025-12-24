import { describe, it, expect } from "bun:test";
import { Effect, ManagedRuntime } from "effect";
import { DiscordService, DiscordServiceLive } from "../../src/services/discord.ts";
import type { DiscordConfig } from "../../src/config/env.ts";

const mockConfig: DiscordConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  redirectUri: "http://localhost:3001/auth/callback",
  appUrl: "http://localhost:3001",
};

describe("DiscordService", () => {
  const runtime = ManagedRuntime.make(DiscordServiceLive(mockConfig));

  it("should generate auth URL with state", async () => {
    const program = Effect.gen(function* () {
      const discord = yield* DiscordService;
      return yield* discord.getAuthUrl("test-state-123");
    });

    const authUrl = await runtime.runPromise(program);

    expect(authUrl).toContain("https://discord.com/api/oauth2/authorize");
    expect(authUrl).toContain("client_id=test-client-id");
    expect(authUrl).toContain("state=test-state-123");
    expect(authUrl).toContain("redirect_uri=");
    expect(authUrl).toContain("scope=identify");
  });

  it("should include correct redirect_uri in auth URL", async () => {
    const program = Effect.gen(function* () {
      const discord = yield* DiscordService;
      return yield* discord.getAuthUrl("state");
    });

    const authUrl = await runtime.runPromise(program);

    expect(authUrl).toContain(encodeURIComponent("http://localhost:3001/auth/callback"));
  });
});
