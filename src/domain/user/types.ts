/**
 * User Domain Types - Pure domain types
 */

import type { Balances, FeeType, ThresholdConfig } from '../fee/types';

/**
 * User entity
 */
export interface User {
  telegramId: string;
  feeUrl: string | null;
  checkInterval: number | null;
  thresholds: ThresholdConfig | null;
  cachedBalances: Partial<Balances> | null;
  cachedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * User configuration for bot operations
 */
export interface UserConfig {
  telegramId: string;
  feeUrl: string | null;
  checkInterval: number;
  thresholds: ThresholdConfig;
}

/**
 * User with cached balance data
 */
export interface UserWithCache extends User {
  cachedBalances: Balances;
  cachedAt: string;
}

/**
 * Repository interface for user persistence
 * This is a domain interface - implementation lives in infrastructure
 */
export interface UserRepository {
  readonly get: (telegramId: string) => Effect.Effect<User | null, never>;
  readonly getOrCreate: (telegramId: string) => Effect.Effect<User, never>;
  readonly getAllConfigured: () => Effect.Effect<ReadonlyArray<User>, never>;
  readonly updateUrl: (telegramId: string, feeUrl: string) => Effect.Effect<void, never>;
  readonly updateThreshold: (telegramId: string, feeType: FeeType, value: number) => Effect.Effect<void, never>;
  readonly updateCheckInterval: (telegramId: string, interval: number) => Effect.Effect<void, never>;
  readonly updateCache: (telegramId: string, balances: Balances) => Effect.Effect<void, never>;
  readonly delete: (telegramId: string) => Effect.Effect<void, never>;
}

import { Context, Effect } from 'effect';
export const UserRepository = Context.GenericTag<UserRepository>('UserRepository');