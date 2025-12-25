import { Context, Effect, Layer } from "effect";
import { eq, sql } from "drizzle-orm";
import { Database } from "../db/client.ts";
import { cards, userCards, type Card, type NewUserCard } from "../db/schema.ts";

export class CardError {
  readonly _tag = "CardError";
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

export class CardService extends Context.Tag("CardService")<
  CardService,
  {
    readonly pullCard: (discordId: string) => Effect.Effect<Card, CardError>;
    readonly getUserCards: (discordId: string) => Effect.Effect<Card[], CardError>;
    readonly getCardById: (cardId: number) => Effect.Effect<Card | null, CardError>;
  }
>() {}

export const CardServiceLive = Layer.effect(
  CardService,
  Effect.gen(function* () {
    const db = yield* Database;

    return CardService.of({
      pullCard: (discordId: string) =>
        Effect.tryPromise({
          try: async () => {
            const roll = Math.random() * 100;
            let rarity: string;

            if (roll < 5) {
              rarity = "SSR";
            } else if (roll < 25) {
              rarity = "SR";
            } else {
              rarity = "R";
            }

            const [card] = await db
              .select()
              .from(cards)
              .where(eq(cards.rarity, rarity))
              .orderBy(sql`RANDOM()`)
              .limit(1);

            if (!card) {
              throw new Error(`No card found for rarity: ${rarity}`);
            }

            await db.insert(userCards).values({
              discordId,
              cardId: card.id,
            });

            return card;
          },
          catch: (error) => new CardError("Failed to pull card", error),
        }),

      getUserCards: (discordId: string) =>
        Effect.tryPromise({
          try: async () => {
            const result = await db
              .select({
                id: cards.id,
                name: cards.name,
                rarity: cards.rarity,
                attack: cards.attack,
                defense: cards.defense,
                description: cards.description,
                imageUrl: cards.imageUrl,
              })
              .from(userCards)
              .innerJoin(cards, eq(userCards.cardId, cards.id))
              .where(eq(userCards.discordId, discordId));

            return result;
          },
          catch: (error) => new CardError("Failed to get user cards", error),
        }),

      getCardById: (cardId: number) =>
        Effect.tryPromise({
          try: async () => {
            const [card] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);

            return card || null;
          },
          catch: (error) => new CardError("Failed to get card", error),
        }),
    });
  }),
);
