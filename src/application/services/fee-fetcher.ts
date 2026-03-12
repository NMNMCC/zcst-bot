/**
 * Fee Fetcher Application Service
 */

import { Context, Effect, Layer } from 'effect';
import type { Balances } from '../../domain/fee';
import { extractBalancesFromResponses } from '../../domain/fee';
import type { BrowserSessionState, CapturedResponse } from '../../infrastructure/browser';
import { BrowserService } from '../../infrastructure/browser';
import { FeeFetcherError } from '../../shared/errors';

export interface FeeFetcherService {
  readonly fetchBalances: (url: string) => Effect.Effect<Balances, FeeFetcherError>;
}

export const FeeFetcherService = Context.GenericTag<FeeFetcherService>('FeeFetcherService');

export const FeeFetcherServiceLive = Layer.effect(
  FeeFetcherService,
  Effect.gen(function* (_) {
    const browser = yield* _(BrowserService);

    return FeeFetcherService.of({
      fetchBalances: (url: string) =>
        Effect.gen(function* (_) {
          const session = yield* _(browser.createSession().pipe(
            Effect.mapError((e) => FeeFetcherError.networkError(url, e))
          ));

          const result = yield* _(
            Effect.gen(function* (_) {
              const stopCapture = browser.captureJsonResponses(session.page);
              yield* _(browser.navigateTo(session.page, url).pipe(
                Effect.mapError((e) => FeeFetcherError.networkError(url, e))
              ));
              yield* _(Effect.sleep('3 seconds'));
              const responses = stopCapture();
              const balances = extractBalancesFromResponses(responses);

              if (Object.keys(balances).length === 0) {
                return yield* _(Effect.fail(FeeFetcherError.noData(url)));
              }

              return balances;
            }),
            Effect.ensuring(
              browser.closeSession(session).pipe(
                Effect.catchAll(() => Effect.void)
              )
            )
          );

          return result;
        }),
    });
  })
);