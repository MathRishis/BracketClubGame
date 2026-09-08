import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
export const brackets = sqliteTable('brackets', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const sessions = sqliteTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('sessions_account_idx').on(t.accountId)],
);

export const bracketActivity = sqliteTable(
  'bracket_activity',
  {
    bracketId: text('bracket_id')
      .notNull()
      .references(() => brackets.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bracketId, t.accountId, t.kind] }),
    index('activity_account_idx').on(t.accountId, t.updatedAt),
  ],
);

export * from './community-schema';
