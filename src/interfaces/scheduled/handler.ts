/**
 * Scheduled Task Handler - Balance check and alerts
 */

import { Effect } from 'effect';
import type { Env } from '../../shared/types';
import { AppLayer, type AppServices, ConfigService, DatabaseService, FeeFetcherService } from '../../application';
import { FEE_TYPE_INFO, DEFAULT_THRESHOLDS, type FeeType, type Balances } from '../../domain/fee';

export const handleScheduled = (env: Env): Effect.Effect<void, never, AppServices> =>
  Effect.gen(function* (_) {
    const db = yield* _(DatabaseService);
    const feeFetcher = yield* _(FeeFetcherService);
    const config = yield* _(ConfigService);

    const users = yield* _(db.getAllConfiguredUsers());

    yield* _(
      Effect.forEach(users, (user) =>
        Effect.gen(function* (_) {
          if (!user.feeUrl || user.checkInterval === 0) return;

          const balances = yield* _(feeFetcher.fetchBalances(user.feeUrl));
          yield* _(db.updateUserCache(user.telegramId, balances));

          const thresholds = user.thresholds ?? DEFAULT_THRESHOLDS;
          const alerts: Array<{ type: string; balance: number; threshold: number }> = [];

          for (const key of Object.keys(FEE_TYPE_INFO)) {
            const feeKey = key as FeeType;
            const balance = balances[feeKey];
            const threshold = thresholds[feeKey];
            if (balance !== undefined && threshold !== undefined && balance < threshold) {
              alerts.push({ type: key, balance, threshold });
            }
          }

          if (alerts.length > 0) {
            const token = yield* _(config.telegramBotToken);
            const alertText = '⚠️ *余额预警*\n\n' +
              alerts.map(a => `*${a.type}*：\`${a.balance.toFixed(2)}\` （预警值 ${a.threshold.toFixed(2)}）`).join('\n') +
              '\n\n使用 /charge 快速充值';

            yield* _(
              Effect.tryPromise({
                try: () =>
                  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: user.telegramId, text: alertText, parse_mode: 'Markdown' }),
                  }),
                catch: () => undefined,
              })
            );
          }
        }).pipe(Effect.catchAllCause(() => Effect.void))
      , { concurrency: 'unbounded' })
    );
  }).pipe(Effect.catchAllCause(() => Effect.void));