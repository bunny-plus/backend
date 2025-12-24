import { describe, it, expect, beforeEach } from "bun:test";
import { Effect, Layer, ManagedRuntime } from "effect";
import { SessionService, SessionServiceLive } from "../../src/services/session.ts";
import { createTestDatabase, cleanupDatabase } from "../utils/test-helpers.ts";
import { Database } from "../../src/db/client.ts";

describe("SessionService", () => {
  let runtime: ManagedRuntime.ManagedRuntime<SessionService | Database, never>;
  let db: any;

  beforeEach(async () => {
    const dbLayer = createTestDatabase();
    const TestLayer = Layer.provide(SessionServiceLive, dbLayer);
    const fullLayer = Layer.merge(dbLayer, TestLayer);

    runtime = ManagedRuntime.make(fullLayer);

    const dbProgram = Effect.gen(function* () {
      return yield* Database;
    });

    db = await runtime.runPromise(dbProgram);
    await cleanupDatabase(db);
  });

  it("should create a session", async () => {
    const program = Effect.gen(function* () {
      const sessionService = yield* SessionService;
      return yield* sessionService.create("discord123", "testuser");
    });

    const session = await runtime.runPromise(program);

    expect(session).toBeDefined();
    expect(session.discordId).toBe("discord123");
    expect(session.username).toBe("testuser");
    expect(session.id).toBeDefined();
  });

  it("should get a session by id", async () => {
    const program = Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const created = yield* sessionService.create("discord456", "anotheruser");
      return yield* sessionService.get(created.id);
    });

    const session = await runtime.runPromise(program);

    expect(session).toBeDefined();
    expect(session?.discordId).toBe("discord456");
    expect(session?.username).toBe("anotheruser");
  });

  it("should return null for non-existent session", async () => {
    const program = Effect.gen(function* () {
      const sessionService = yield* SessionService;
      return yield* sessionService.get("00000000-0000-0000-0000-000000000000");
    });

    const session = await runtime.runPromise(program);

    expect(session).toBeNull();
  });

  it("should delete a session", async () => {
    const program = Effect.gen(function* () {
      const sessionService = yield* SessionService;
      const created = yield* sessionService.create("discord789", "deleteuser");
      yield* sessionService.delete(created.id);
      return yield* sessionService.get(created.id);
    });

    const session = await runtime.runPromise(program);

    expect(session).toBeNull();
  });

  it("should create session with expiry date", async () => {
    const program = Effect.gen(function* () {
      const sessionService = yield* SessionService;
      return yield* sessionService.create("discord999", "expiryuser");
    });

    const session = await runtime.runPromise(program);

    expect(session.expiresAt).toBeDefined();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
