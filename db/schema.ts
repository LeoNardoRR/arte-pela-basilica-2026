import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const artworks = sqliteTable("artworks", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  technique: text("technique").notNull(),
  dimensions: text("dimensions").notNull(),
  status: text("status", { enum: ["available", "reserved", "sold"] }).notNull().default("available"),
  palette: text("palette").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const reservations = sqliteTable("reservations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  artworkId: integer("artwork_id").notNull().references(() => artworks.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});
