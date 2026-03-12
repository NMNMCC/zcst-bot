/**
 * Database Schema - Drizzle ORM definitions for Cloudflare D1 (SQLite)
 */

import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';
import type { FeeType, Balances, ThresholdConfig } from '../../domain/fee/types';

export const FEE_TYPES = ['electricity', 'cold_water', 'hot_water'] as const;
export type { FeeType, Balances, ThresholdConfig } from '../../domain/fee/types';

export const users = sqliteTable('users', {
  telegramId: text('telegram_id').primaryKey(),
  feeUrl: text('fee_url'),
  checkInterval: integer('check_interval').default(300),
  thresholds: text('thresholds', { mode: 'json' })
    .$type<ThresholdConfig>()
    .default({ electricity: 5.0, cold_water: 1.0, hot_water: 0.5 }),
  cachedBalances: text('cached_balances', { mode: 'json' })
    .$type<Partial<Balances>>(),
  cachedAt: text('cached_at'),
  createdAt: text('created_at').default(new Date().toISOString()),
  updatedAt: text('updated_at').default(new Date().toISOString()),
});

export const rechargeSessions = sqliteTable('recharge_sessions', {
  id: text('id').primaryKey(),
  telegramId: text('telegram_id').notNull().references(() => users.telegramId, { onDelete: 'cascade' }),
  browserSessionId: text('browser_session_id'),
  step: text('step').notNull(),
  selectedFeeType: text('selected_fee_type').$type<FeeType>(),
  selectedAmountIndex: integer('selected_amount_index'),
  availableAmounts: text('available_amounts', { mode: 'json' })
    .$type<Array<{ index: number; text: string }>>(),
  availablePaymentMethods: text('available_payment_methods', { mode: 'json' })
    .$type<Array<{ index: number; name: string }>>(),
  paymentUrl: text('payment_url'),
  balanceBefore: real('balance_before'),
  createdAt: text('created_at').default(new Date().toISOString()),
  expiresAt: text('expires_at'),
}, (table) => ({
  telegramIdIdx: index('recharge_sessions_telegram_id_idx').on(table.telegramId),
  expiresAtIdx: index('recharge_sessions_expires_at_idx').on(table.expiresAt),
}));

export const alertHistory = sqliteTable('alert_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: text('telegram_id').notNull().references(() => users.telegramId, { onDelete: 'cascade' }),
  feeType: text('fee_type').notNull().$type<FeeType>(),
  balance: real('balance').notNull(),
  threshold: real('threshold').notNull(),
  sentAt: text('sent_at').default(new Date().toISOString()),
}, (table) => ({
  telegramIdIdx: index('alert_history_telegram_id_idx').on(table.telegramId),
  sentAtIdx: index('alert_history_sent_at_idx').on(table.sentAt),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RechargeSession = typeof rechargeSessions.$inferSelect;
export type NewRechargeSession = typeof rechargeSessions.$inferInsert;
export type AlertHistory = typeof alertHistory.$inferSelect;
export type NewAlertHistory = typeof alertHistory.$inferInsert;