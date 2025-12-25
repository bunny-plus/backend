import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../db/client.ts";
import { users, type User, type NewUser } from "../db/schema.ts";

export class UserError {
  readonly _tag = "UserError";
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

export class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly upsert: (
      discordId: string,
      username: string,
      avatar: string | null,
    ) => Effect.Effect<User, UserError>;
    readonly get: (discordId: string) => Effect.Effect<User | null, UserError>;
    readonly completeOnboarding: (discordId: string) => Effect.Effect<void, UserError>;
    readonly spendCurrency: (discordId: string, amount: number) => Effect.Effect<User, UserError>;
  }
>() {}

export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Database;

    return UserService.of({
      upsert: (discordId: string, username: string, avatar: string | null) =>
        Effect.tryPromise({
          try: async () => {
            const [user] = await db
              .insert(users)
              .values({
                discordId,
                username,
                avatar,
              })
              .onConflictDoUpdate({
                target: users.discordId,
                set: {
                  username,
                  avatar,
                  updatedAt: new Date(),
                },
              })
              .returning();

            if (!user) {
              throw new Error("Failed to upsert user");
            }

            return user;
          },
          catch: (error) => new UserError("Failed to upsert user", error),
        }),

      get: (discordId: string) =>
        Effect.tryPromise({
          try: async () => {
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.discordId, discordId))
              .limit(1);

            return user || null;
          },
          catch: (error) => new UserError("Failed to get user", error),
        }),

      completeOnboarding: (discordId: string) =>
        Effect.tryPromise({
          try: async () => {
            await db
              .update(users)
              .set({ onboarding: true, updatedAt: new Date() })
              .where(eq(users.discordId, discordId));
          },
          catch: (error) => new UserError("Failed to complete onboarding", error),
        }),

      spendCurrency: (discordId: string, amount: number) =>
        Effect.tryPromise({
          try: async () => {
            const [currentUser] = await db
              .select()
              .from(users)
              .where(eq(users.discordId, discordId))
              .limit(1);

            if (!currentUser) {
              throw new Error("User not found");
            }

            if (currentUser.currency < amount) {
              throw new Error("Insufficient currency");
            }

            const [updatedUser] = await db
              .update(users)
              .set({
                currency: currentUser.currency - amount,
                updatedAt: new Date(),
              })
              .where(eq(users.discordId, discordId))
              .returning();

            if (!updatedUser) {
              throw new Error("Failed to update currency");
            }

            return updatedUser;
          },
          catch: (error) => new UserError("Failed to spend currency", error),
        }),
    });
  }),
);
