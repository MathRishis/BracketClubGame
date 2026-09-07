import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const brackets = sqliteTable('brackets', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
 description: text('description').notNull(), state: text('state').notNull(), version: integer('version').notNull().default(0),
 createdAt: integer('created_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
 id: text('id').primaryKey(), username: text('username').notNull().unique(), displayName: text('display_name').notNull(),
 passwordHash: text('password_hash').notNull(), passwordSalt: text('password_salt').notNull(), createdAt: integer('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
 tokenHash: text('token_hash').primaryKey(), accountId: text('account_id').notNull(), expiresAt: integer('expires_at').notNull(),
});

export const bracketActivity = sqliteTable('bracket_activity', {
 bracketId: text('bracket_id').notNull(), accountId: text('account_id').notNull(), kind: text('kind').notNull(), updatedAt: integer('updated_at').notNull(),
});
