import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const communityAccounts = sqliteTable('community_accounts', {
  accountId: text('account_id').primaryKey(),
  admin: integer('admin').notNull().default(0),
  bio: text('bio').notNull().default(''),
});
export const templates = sqliteTable(
  'templates',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    title: text('title').notNull(),
    data: text('data').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('templates_account').on(t.accountId)],
);
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    bracketId: text('bracket_id').notNull(),
    message: text('message').notNull(),
    createdAt: integer('created_at').notNull(),
    seen: integer('seen').notNull().default(0),
  },
  (t) => [index('notifications_account_created').on(t.accountId, t.createdAt)],
);
export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    bracketId: text('bracket_id').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
    resolved: integer('resolved').notNull().default(0),
  },
  (t) => [index('reports_resolved').on(t.resolved, t.createdAt)],
);
export const operations = sqliteTable('operations', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const participation = sqliteTable(
  'participation',
  {
    id: text('id').primaryKey(),
    bracketId: text('bracket_id').notNull(),
    viewer: text('viewer').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('participation_bracket_updated').on(t.bracketId, t.updatedAt)],
);
