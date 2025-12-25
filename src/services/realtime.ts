import { Context, Effect, Layer } from "effect";
import { gt, eq, count } from "drizzle-orm";
import { Database } from "../db/client.ts";
import { sessions, users, userCards, cards } from "../db/schema.ts";

export interface OnlineUser {
  discordId: string;
  username: string;
  avatar: string | null;
  currency: number;
  cardCounts: {
    R: number;
    SR: number;
    SSR: number;
  };
}

export class RealtimeService extends Context.Tag("RealtimeService")<
  RealtimeService,
  {
    readonly getOnlineUsers: () => Effect.Effect<OnlineUser[], Error>;
  }
>() {}

export const RealtimeServiceLive = Layer.effect(
  RealtimeService,
  Effect.gen(function* () {
    const db = yield* Database;

    return RealtimeService.of({
      getOnlineUsers: (): Effect.Effect<OnlineUser[], Error> =>
        Effect.tryPromise({
          try: async (): Promise<OnlineUser[]> => {
            const onlineUsers = await db
              .selectDistinct({
                discordId: users.discordId,
                username: users.username,
                avatar: users.avatar,
                currency: users.currency,
              })
              .from(sessions)
              .innerJoin(users, eq(sessions.discordId, users.discordId))
              .where(gt(sessions.expiresAt, new Date()));

            // Get card counts for each user
            const usersWithCardCounts = await Promise.all(
              onlineUsers.map(async (user) => {
                const cardCountsRaw = await db
                  .select({
                    rarity: cards.rarity,
                    count: count(),
                  })
                  .from(userCards)
                  .innerJoin(cards, eq(userCards.cardId, cards.id))
                  .where(eq(userCards.discordId, user.discordId))
                  .groupBy(cards.rarity);

                const cardCounts = {
                  R: 0,
                  SR: 0,
                  SSR: 0,
                };

                for (const { rarity, count: c } of cardCountsRaw) {
                  if (rarity === "R" || rarity === "SR" || rarity === "SSR") {
                    cardCounts[rarity] = c;
                  }
                }

                return {
                  ...user,
                  cardCounts,
                };
              }),
            );

            return usersWithCardCounts;
          },
          catch: (error) => new Error(String(error)),
        }),
    });
  }),
);
