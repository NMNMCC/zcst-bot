/**
 * Shared Types - Environment and common types
 */

import type { FeeType, Balances, ThresholdConfig } from '../../domain/fee/types';

export type { Balances, FeeType, ThresholdConfig } from '../../domain/fee/types';

export interface Env {
  DB: D1Database;
  BROWSER: Fetcher;
  KV: KVNamespace;
  ENVIRONMENT: string;
  TELEGRAM_BOT_TOKEN?: string;
}

export interface BotContext {
  userId: string;
  chatId: number;
  messageId?: number;
  state?: Record<string, unknown>;
}

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};