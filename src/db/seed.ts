import { Effect } from "effect";
import { DatabaseConfig } from "../config/env.ts";
import { DatabaseLive } from "./client.ts";
import { Database } from "./client.ts";
import { cards } from "./schema.ts";
import { cardsSeedData } from "./seed-cards.ts";

const seedProgram = Effect.gen(function* () {
  const db = yield* Database;

  console.log("seeding cards...");

  yield* Effect.promise(() => db.insert(cards).values(cardsSeedData));

  console.log(`seeded ${cardsSeedData.length} cards successfully!`);
});

const program = Effect.gen(function* () {
  const dbConfig = yield* DatabaseConfig;

  const AppLayer = DatabaseLive(dbConfig);

  yield* Effect.provide(seedProgram, AppLayer);
});

Effect.runPromise(program)
  .then(() => {
    console.log("seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("seeding failed:", error);
    process.exit(1);
  });
