import { Effect, Layer, ManagedRuntime } from "effect";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema.ts";
import { Database } from "../../src/db/client.ts";

export function createTestDatabase() {
  const connectionString =
    process.env.TEST_DATABASE_URL ??
    "postgresql://bunnyplus:bunnyplus@localhost:5432/bunnyplus_test";

  return Layer.scoped(
    Database,
    Effect.gen(function* () {
      const pool = new Pool({ connectionString });

      yield* Effect.addFinalizer(() => Effect.promise(async () => pool.end()));

      return drizzle(pool, { schema });
    }),
  );
}

export async function cleanupDatabase(db: ReturnType<typeof drizzle<typeof schema>>) {
  await db.delete(schema.sessions);
}
