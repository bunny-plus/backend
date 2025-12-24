import { describe, it, expect, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { Effect, Layer, ManagedRuntime } from "effect";
import { SessionService, SessionServiceLive } from "../../src/services/session.ts";
import { createApiRoutes } from "../../src/routes/api.ts";
import { createTestDatabase, cleanupDatabase } from "../utils/test-helpers.ts";
import { Database } from "../../src/db/client.ts";

describe("API Routes", () => {
  let app: Elysia;
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

    app = new Elysia().use(createApiRoutes(runtime));
  });

  describe("GET /api/session", () => {
    it("should return 401 when no session cookie", async () => {
      const response = await app.handle(new Request("http://localhost/api/session"));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should return session data when valid cookie exists", async () => {
      const createProgram = Effect.gen(function* () {
        const sessionService = yield* SessionService;
        return yield* sessionService.create("discord123", "testuser");
      });

      const session = await runtime.runPromise(createProgram);

      const response = await app.handle(
        new Request("http://localhost/api/session", {
          headers: {
            Cookie: `session_id=${session.id}`,
          },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.user.id).toBe("discord123");
      expect(body.user.username).toBe("testuser");
    });

    it("should return 401 for invalid session id", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/session", {
          headers: {
            Cookie: "session_id=invalid-uuid",
          },
        }),
      );

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/logout", () => {
    it("should logout and clear cookie", async () => {
      const createProgram = Effect.gen(function* () {
        const sessionService = yield* SessionService;
        return yield* sessionService.create("discord456", "logoutuser");
      });

      const session = await runtime.runPromise(createProgram);

      const response = await app.handle(
        new Request("http://localhost/api/logout", {
          method: "POST",
          headers: {
            Cookie: `session_id=${session.id}`,
          },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);

      const setCookie = response.headers.get("Set-Cookie");
      expect(setCookie).toContain("Max-Age=0");
    });

    it("should work even without session cookie", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/logout", {
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });
});
