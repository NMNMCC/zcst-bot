/**
 * Database Service - D1 database operations
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, isNotNull } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { users, rechargeSessions, type User, type NewUser, type RechargeSession, type NewRechargeSession } from './schema';
import type { Balances, FeeType, ThresholdConfig } from '../../domain/fee';
import { DEFAULT_THRESHOLDS, DEFAULT_CHECK_INTERVAL } from '../../domain/fee';
import { DatabaseError } from '../../shared/errors';

export interface DatabaseService {
  readonly getUser: (telegramId: string) => Effect.Effect<User | null, DatabaseError>;
  readonly getOrCreateUser: (telegramId: string) => Effect.Effect<User, DatabaseError>;
  readonly updateUserUrl: (telegramId: string, url: string) => Effect.Effect<User, DatabaseError>;
  readonly updateUserThreshold: (telegramId: string, feeType: FeeType, value: number) => Effect.Effect<User, DatabaseError>;
  readonly updateUserCheckInterval: (telegramId: string, interval: number) => Effect.Effect<User, DatabaseError>;
  readonly updateUserCache: (telegramId: string, balances: Balances) => Effect.Effect<User, DatabaseError>;
  readonly deleteUser: (telegramId: string) => Effect.Effect<void, DatabaseError>;
  readonly getAllConfiguredUsers: () => Effect.Effect<ReadonlyArray<User>, DatabaseError>;
  readonly createRechargeSession: (telegramId: string, browserSessionId: string) => Effect.Effect<RechargeSession, DatabaseError>;
  readonly getRechargeSession: (sessionId: string) => Effect.Effect<RechargeSession | null, DatabaseError>;
  readonly deleteRechargeSession: (sessionId: string) => Effect.Effect<void, DatabaseError>;
}

export const DatabaseService = Context.GenericTag<DatabaseService>('DatabaseService');

export const makeDatabaseService = (d1: D1Database): DatabaseService => {
  const db = drizzle(d1);

  const wrapQuery = <T>(operation: string, query: Promise<T>): Effect.Effect<T, DatabaseError> =>
    Effect.tryPromise({
      try: () => query,
      catch: (error) => DatabaseError.queryFailed(operation, error),
    });

  return {
    getUser: (telegramId: string) =>
      wrapQuery(
        'getUser',
        db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
      ).pipe(Effect.map((result) => result[0] ?? null)),

    getOrCreateUser: (telegramId: string) =>
      Effect.gen(function* (_) {
        const existing = yield* _(wrapQuery(
          'getOrCreateUser.check',
          db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
        ));

        if (existing[0]) return existing[0];

        const now = new Date().toISOString();
        const newUser: NewUser = {
          telegramId,
          thresholds: { ...DEFAULT_THRESHOLDS },
          checkInterval: DEFAULT_CHECK_INTERVAL,
          createdAt: now,
          updatedAt: now,
        };

        yield* _(wrapQuery('getOrCreateUser.insert', db.insert(users).values(newUser)));

        const result = yield* _(wrapQuery(
          'getOrCreateUser.fetch',
          db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
        ));

        if (!result[0]) {
          return yield* _(Effect.fail(DatabaseError.queryFailed('getOrCreateUser', new Error('Failed to create user'))));
        }

        return result[0];
      }),

    updateUserUrl: (telegramId: string, url: string) =>
      Effect.gen(function* (_) {
        const now = new Date().toISOString();
        yield* _(wrapQuery(
          'updateUserUrl',
          db.update(users).set({ feeUrl: url, updatedAt: now }).where(eq(users.telegramId, telegramId))
        ));

        const result = yield* _(wrapQuery(
          'updateUserUrl.fetch',
          db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
        ));

        if (!result[0]) {
          return yield* _(Effect.fail(DatabaseError.queryFailed('updateUserUrl', new Error('User not found after update'))));
        }

        return result[0];
      }),

    updateUserThreshold: (telegramId: string, feeType: FeeType, value: number) =>
      Effect.gen(function* (_) {
        const userResult = yield* _(wrapQuery(
          'updateUserThreshold.getUser',
          db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
        ));

        const user = userResult[0];
        if (!user) {
          return yield* _(Effect.fail(DatabaseError.notFound('users', telegramId)));
        }

        const currentThresholds = user.thresholds ?? { ...DEFAULT_THRESHOLDS };
        const newThresholds = { ...currentThresholds, [feeType]: value };
        const now = new Date().toISOString();

        yield* _(wrapQuery(
          'updateUserThreshold.update',
          db.update(users).set({ thresholds: newThresholds, updatedAt: now }).where(eq(users.telegramId, telegramId))
        ));

        const result = yield* _(wrapQuery(
          'updateUserThreshold.fetch',
          db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
        ));

        if (!result[0]) {
          return yield* _(Effect.fail(DatabaseError.queryFailed('updateUserThreshold', new Error('User not found after update'))));
        }

        return result[0];
      }),

    updateUserCheckInterval: (telegramId: string, interval: number) =>
      Effect.gen(function* (_) {
        const now = new Date().toISOString();
        yield* _(wrapQuery(
          'updateUserCheckInterval',
          db.update(users).set({ checkInterval: interval, updatedAt: now }).where(eq(users.telegramId, telegramId))
        ));

        const result = yield* _(wrapQuery(
          'updateUserCheckInterval.fetch',
          db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
        ));

        if (!result[0]) {
          return yield* _(Effect.fail(DatabaseError.queryFailed('updateUserCheckInterval', new Error('User not found after update'))));
        }

        return result[0];
      }),

    updateUserCache: (telegramId: string, balances: Balances) =>
      Effect.gen(function* (_) {
        const now = new Date().toISOString();
        yield* _(wrapQuery(
          'updateUserCache',
          db.update(users).set({ cachedBalances: balances, cachedAt: now, updatedAt: now }).where(eq(users.telegramId, telegramId))
        ));

        const result = yield* _(wrapQuery(
          'updateUserCache.fetch',
          db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
        ));

        if (!result[0]) {
          return yield* _(Effect.fail(DatabaseError.queryFailed('updateUserCache', new Error('User not found after update'))));
        }

        return result[0];
      }),

    deleteUser: (telegramId: string) =>
      wrapQuery('deleteUser', db.delete(users).where(eq(users.telegramId, telegramId))).pipe(
        Effect.asVoid
      ),

    getAllConfiguredUsers: () =>
      wrapQuery(
        'getAllConfiguredUsers',
        db.select().from(users).where(isNotNull(users.feeUrl))
      ),

    createRechargeSession: (telegramId: string, browserSessionId: string) =>
      Effect.gen(function* (_) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
        const session: NewRechargeSession = {
          id: crypto.randomUUID(),
          telegramId,
          browserSessionId,
          step: 'type_selection',
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        };

        yield* _(wrapQuery('createRechargeSession.insert', db.insert(rechargeSessions).values(session)));

        const result = yield* _(wrapQuery(
          'createRechargeSession.fetch',
          db.select().from(rechargeSessions).where(eq(rechargeSessions.id, session.id!)).limit(1)
        ));

        if (!result[0]) {
          return yield* _(Effect.fail(DatabaseError.queryFailed('createRechargeSession', new Error('Failed to create recharge session'))));
        }

        return result[0];
      }),

    getRechargeSession: (sessionId: string) =>
      wrapQuery(
        'getRechargeSession',
        db.select().from(rechargeSessions).where(eq(rechargeSessions.id, sessionId)).limit(1)
      ).pipe(Effect.map((result) => result[0] ?? null)),

    deleteRechargeSession: (sessionId: string) =>
      wrapQuery('deleteRechargeSession', db.delete(rechargeSessions).where(eq(rechargeSessions.id, sessionId))).pipe(
        Effect.asVoid
      ),
  };
};

export const DatabaseLayer = (d1: D1Database) => Layer.succeed(DatabaseService, makeDatabaseService(d1));