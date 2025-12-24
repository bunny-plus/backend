import { Elysia } from "elysia";
import { Effect, ManagedRuntime } from "effect";
import { SessionService } from "../services/session.ts";

export const createApiRoutes = (runtime: ManagedRuntime.ManagedRuntime<SessionService, never>) =>
  new Elysia({ prefix: "/api" })
    .get("/session", async ({ cookie, set }) => {
      const sessionId = cookie.session_id?.value;

      if (typeof sessionId !== "string" || sessionId.length === 0) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const program = Effect.gen(function* () {
          const sessionService = yield* SessionService;
          return yield* sessionService.get(sessionId);
        });

        const session = await runtime.runPromise(program);

        if (!session) {
          set.status = 401;
          return { error: "Session not found or expired" };
        }

        return {
          user: {
            id: session.discordId,
            username: session.username,
            displayName: session.username,
          },
        };
      } catch (error) {
        set.status = 401;
        return { error: "Invalid session" };
      }
    })
    .post("/logout", async ({ cookie, set }) => {
      const sessionId = cookie.session_id?.value;

      if (typeof sessionId === "string" && sessionId.length > 0) {
        const program = Effect.gen(function* () {
          const sessionService = yield* SessionService;
          return yield* sessionService.delete(sessionId);
        });

        await runtime.runPromise(program);
      }

      set.headers["Set-Cookie"] = "session_id=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";

      return { success: true };
    });
