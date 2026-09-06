import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const brackets = sqliteTable('brackets', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
 description: text('description').notNull(), state: text('state').notNull(), version: integer('version').notNull().default(0),
 createdAt: integer('created_at').notNull(),
});
