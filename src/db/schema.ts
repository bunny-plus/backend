import { pgTable, text, timestamp, uuid, integer, boolean, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  discordId: text("discord_id").primaryKey(),
  username: text("username").notNull(),
  avatar: text("avatar"),
  currency: integer("currency").notNull().default(10),
  onboarding: boolean("onboarding").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: text("discord_id")
    .notNull()
    .references(() => users.discordId, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  rarity: text("rarity").notNull(), // 'R', 'SR', 'SSR'
  attack: integer("attack").notNull(),
  defense: integer("defense").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
});

export const userCards = pgTable("user_cards", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id")
    .notNull()
    .references(() => users.discordId, { onDelete: "cascade" }),
  cardId: integer("card_id")
    .notNull()
    .references(() => cards.id),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type UserCard = typeof userCards.$inferSelect;
export type NewUserCard = typeof userCards.$inferInsert;
