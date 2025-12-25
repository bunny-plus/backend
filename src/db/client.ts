import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Context, Effect, Layer } from "effect";
import * as schema from "./schema.ts";
import type { DatabaseConfig } from "../config/env.ts";

export class Database extends Context.Tag("Database")<
  Database,
  ReturnType<typeof drizzle<typeof schema>>
>() {}

export const DatabaseLive = (config: DatabaseConfig) =>
  Layer.scoped(
    Database,
    Effect.gen(function* () {
      const pool = new Pool({
        connectionString: config.url,
        ssl: config.url.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      });

      yield* Effect.addFinalizer(() => Effect.promise(async () => pool.end()));

      return drizzle(pool, { schema });
    }),
  );
