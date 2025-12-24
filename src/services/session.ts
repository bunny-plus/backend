import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../db/client.ts";
import { sessions, type Session, type NewSession } from "../db/schema.ts";

export class SessionError {
  readonly _tag = "SessionError";
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

export class SessionService extends Context.Tag("SessionService")<
  SessionService,
  {
    readonly create: (discordId: string, username: string) => Effect.Effect<Session, SessionError>;
    readonly get: (sessionId: string) => Effect.Effect<Session | null, SessionError>;
    readonly delete: (sessionId: string) => Effect.Effect<void, SessionError>;
    readonly cleanup: () => Effect.Effect<void, SessionError>;
  }
>() {}

const SESSION_DURATION_DAYS = 30;

export const SessionServiceLive = Layer.effect(
  SessionService,
  Effect.gen(function* () {
    const db = yield* Database;

    return SessionService.of({
      create: (discordId: string, username: string) =>
        Effect.tryPromise({
          try: async () => {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

            const [session] = await db
              .insert(sessions)
              .values({
                discordId,
                username,
                expiresAt,
              })
              .returning();

            if (!session) {
              throw new Error("Failed to create session");
            }

            return session;
          },
          catch: (error) => new SessionError("Failed to create session", error),
        }),

      get: (sessionId: string) =>
        Effect.tryPromise({
          try: async () => {
            const [session] = await db
              .select()
              .from(sessions)
              .where(eq(sessions.id, sessionId))
              .limit(1);

            if (!session) {
              return null;
            }

            if (session.expiresAt < new Date()) {
              await db.delete(sessions).where(eq(sessions.id, sessionId));
              return null;
            }

            return session;
          },
          catch: (error) => new SessionError("Failed to get session", error),
        }),

      delete: (sessionId: string) =>
        Effect.tryPromise({
          try: async () => {
            await db.delete(sessions).where(eq(sessions.id, sessionId));
          },
          catch: (error) => new SessionError("Failed to delete session", error),
        }),

      cleanup: () =>
        Effect.tryPromise({
          try: async () => {
            await db.delete(sessions).where(eq(sessions.expiresAt, new Date()));
          },
          catch: (error) => new SessionError("Failed to cleanup sessions", error),
        }),
    });
  }),
);
