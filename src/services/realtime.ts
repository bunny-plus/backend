import { Context, Effect, Layer } from "effect";
import { gt, eq } from "drizzle-orm";
import { Database } from "../db/client.ts";
import { sessions, users } from "../db/schema.ts";

export interface OnlineUser {
  discordId: string;
  username: string;
  avatar: string | null;
}

export class RealtimeService extends Context.Tag("RealtimeService")<
  RealtimeService,
  {
    readonly getOnlineUsers: () => Effect.Effect<OnlineUser[]>;
  }
>() {}

export const RealtimeServiceLive = Layer.effect(
  RealtimeService,
  Effect.gen(function* () {
    const db = yield* Database;

    return RealtimeService.of({
      getOnlineUsers: () =>
        Effect.tryPromise({
          try: async () => {
            const onlineUsers = await db
              .selectDistinct({
                discordId: users.discordId,
                username: users.username,
                avatar: users.avatar,
              })
              .from(sessions)
              .innerJoin(users, eq(sessions.discordId, users.discordId))
              .where(gt(sessions.expiresAt, new Date()));

            return onlineUsers;
          },
          catch: () => [],
        }),
    });
  }),
);
