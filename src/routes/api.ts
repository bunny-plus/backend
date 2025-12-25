import { Elysia } from "elysia";
import { Effect, ManagedRuntime } from "effect";
import { SessionService } from "../services/session.ts";
import { UserService } from "../services/user.ts";
import { CardService } from "../services/card.ts";

export const createApiRoutes = (
  runtime: ManagedRuntime.ManagedRuntime<SessionService | UserService | CardService, never>,
) =>
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
          const userService = yield* UserService;

          const session = yield* sessionService.get(sessionId);
          if (!session) {
            return null;
          }

          const user = yield* userService.get(session.discordId);
          if (!user) {
            return null;
          }

          return { session, user };
        });

        const result = await runtime.runPromise(program);

        if (!result) {
          set.status = 401;
          return { error: "Session not found or expired" };
        }

        return {
          user: {
            id: result.user.discordId,
            username: result.user.username,
            displayName: result.user.username,
          },
          currency: result.user.currency,
          onboarding: result.user.onboarding,
        };
      } catch (error) {
        set.status = 401;
        return { error: "Invalid session" };
      }
    })
    .post("/onboarding/complete", async ({ cookie, set }) => {
      const sessionId = cookie.session_id?.value;

      if (typeof sessionId !== "string" || sessionId.length === 0) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const program = Effect.gen(function* () {
          const sessionService = yield* SessionService;
          const userService = yield* UserService;

          const session = yield* sessionService.get(sessionId);
          if (!session) {
            return false;
          }

          yield* userService.completeOnboarding(session.discordId);
          return true;
        });

        const success = await runtime.runPromise(program);

        if (!success) {
          set.status = 401;
          return { error: "Session not found" };
        }

        return { success: true };
      } catch (error) {
        set.status = 500;
        return { error: "Failed to update onboarding status" };
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
    })
    .post("/gacha/pull", async ({ cookie, set }) => {
      const sessionId = cookie.session_id?.value;

      if (typeof sessionId !== "string" || sessionId.length === 0) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const program = Effect.gen(function* () {
          const sessionService = yield* SessionService;
          const userService = yield* UserService;
          const cardService = yield* CardService;

          const session = yield* sessionService.get(sessionId);
          if (!session) {
            return { success: false, error: "Session not found" };
          }

          const updatedUser = yield* userService.spendCurrency(session.discordId, 1);

          const card = yield* cardService.pullCard(session.discordId);

          return {
            success: true,
            card,
            remainingCurrency: updatedUser.currency,
          };
        });

        const result = await runtime.runPromise(program);

        if (!result.success) {
          set.status = 400;
          return { error: result.error };
        }

        return {
          card: result.card,
          remainingCurrency: result.remainingCurrency,
        };
      } catch (error) {
        console.error("Gacha pull error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to pull card";

        if (errorMessage.includes("Insufficient currency")) {
          set.status = 400;
          return { error: "Not enough carrots to pull gacha" };
        }

        set.status = 500;
        return { error: "Failed to pull card", details: errorMessage };
      }
    })
    .get("/cards", async ({ cookie, set }) => {
      const sessionId = cookie.session_id?.value;

      if (typeof sessionId !== "string" || sessionId.length === 0) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const program = Effect.gen(function* () {
          const sessionService = yield* SessionService;
          const cardService = yield* CardService;

          const session = yield* sessionService.get(sessionId);
          if (!session) {
            return null;
          }

          const cards = yield* cardService.getUserCards(session.discordId);
          return cards;
        });

        const cards = await runtime.runPromise(program);

        if (!cards) {
          set.status = 401;
          return { error: "Session not found" };
        }

        return { cards };
      } catch (error) {
        set.status = 500;
        return { error: "Failed to get cards" };
      }
    });
