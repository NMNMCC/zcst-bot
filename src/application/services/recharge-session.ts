/**
 * Recharge Session Application Service
 */

import { Context, Effect, Layer } from 'effect';
import type { Balances, FeeType } from '../../domain/fee';
import { BUSINESSTYPE_MAP, BUSINESSTYPE_TO_BUTTON_INDEX, PAY_URL_PATTERNS } from '../../domain/recharge';
import type { BrowserSessionState } from '../../infrastructure/browser';
import { BrowserService } from '../../infrastructure/browser';
import { RechargeError } from '../../shared/errors';

const HOOK_UNI_SHOWMODAL = `
  if (window.uni && window.uni.showModal) {
    window.uni.showModal = function(opts) {
      if (opts.success) setTimeout(() => opts.success({confirm: true, cancel: false}), 100);
    };
  }
`;

export interface RechargeSessionData {
  session: BrowserSessionState;
  balances: Balances;
  feeType?: FeeType;
  amounts?: Array<{ index: number; text: string }>;
  selectedAmountIndex?: number;
  paymentMethods?: Array<{ index: number; name: string }>;
  paymentUrl?: string;
}

export interface RechargeSessionService {
  readonly startSession: (feeUrl: string) => Effect.Effect<RechargeSessionData, RechargeError>;
  readonly getRechargeAmounts: (sessionData: RechargeSessionData, feeType: FeeType) => Effect.Effect<RechargeSessionData, RechargeError>;
  readonly confirmAmount: (sessionData: RechargeSessionData, amountIndex: number) => Effect.Effect<RechargeSessionData, RechargeError>;
  readonly selectPaymentMethod: (sessionData: RechargeSessionData, methodIndex: number) => Effect.Effect<string, RechargeError>;
  readonly closeSession: (sessionData: RechargeSessionData) => Effect.Effect<void, RechargeError>;
}

export const RechargeSessionService = Context.GenericTag<RechargeSessionService>('RechargeSessionService');

export const RechargeSessionServiceLive = Layer.effect(
  RechargeSessionService,
  Effect.gen(function* (_) {
    const browser = yield* _(BrowserService);

    const wrapPromise = <T>(promise: Promise<T>): Effect.Effect<T, RechargeError> =>
      Effect.tryPromise({
        try: () => promise,
        catch: () => RechargeError.paymentFailed('Browser operation failed'),
      });

    return RechargeSessionService.of({
      startSession: (feeUrl: string) =>
        Effect.gen(function* (_) {
          const session = yield* _(browser.createSession().pipe(
            Effect.mapError(() => RechargeError.paymentFailed('Failed to create browser session'))
          ));
          yield* _(browser.navigateTo(session.page, feeUrl).pipe(
            Effect.mapError(() => RechargeError.paymentFailed('Failed to navigate to fee page'))
          ));
          yield* _(Effect.sleep('3 seconds'));

          const balances: Balances = {};
          yield* _(wrapPromise(session.page.evaluate(HOOK_UNI_SHOWMODAL)));

          return { session, balances };
        }),

      getRechargeAmounts: (sessionData: RechargeSessionData, feeType: FeeType) =>
        Effect.gen(function* (_) {
          const { session } = sessionData;
          const page = session.page;
          const bt = BUSINESSTYPE_MAP[feeType];
          if (!bt) {
            return yield* _(Effect.fail(RechargeError.invalidFeeType(feeType)));
          }

          const btnIndex = BUSINESSTYPE_TO_BUTTON_INDEX[bt];
          const buttons = yield* _(wrapPromise(page.$$('.recharge-btn')));
          if (btnIndex >= buttons.length) {
            return yield* _(Effect.fail(RechargeError.noAmounts()));
          }
          yield* _(wrapPromise(buttons[btnIndex].tap()));

          yield* _(Effect.sleep('3 seconds'));
          yield* _(
            Effect.tryPromise({
              try: () => page.waitForSelector('.money-item', { timeout: 8000, visible: true }),
              catch: () => RechargeError.noAmounts(),
            })
          );

          const items = yield* _(wrapPromise(page.$$('.money-item')));
          const amounts: Array<{ index: number; text: string }> = [];
          for (let i = 0; i < items.length; i++) {
            const text = yield* _(
              wrapPromise(
                items[i].evaluate((el: unknown) => (el as { textContent?: string }).textContent?.trim().replace(/\n/g, ' ') || '')
              )
            );
            amounts.push({ index: i, text });
          }

          return { ...sessionData, feeType, amounts };
        }),

      confirmAmount: (sessionData: RechargeSessionData, amountIndex: number) =>
        Effect.gen(function* (_) {
          const { session } = sessionData;
          const page = session.page;

          const items = yield* _(wrapPromise(page.$$('.money-item')));
          yield* _(wrapPromise(items[amountIndex].tap()));
          yield* _(Effect.sleep('500 millis'));

          yield* _(wrapPromise(page.evaluate(HOOK_UNI_SHOWMODAL)));

          yield* _(wrapPromise(page.tap('.submit-btn')));
          yield* _(
            Effect.tryPromise({
              try: () => page.waitForFunction('window.location.href.includes("cloudpaygateway")', { timeout: 30000 }),
              catch: () => RechargeError.paymentFailed('Timeout waiting for payment gateway'),
            })
          );
          yield* _(
            Effect.tryPromise({
              try: () => page.waitForSelector('a.pay-botton', { timeout: 25000, visible: true }),
              catch: () => RechargeError.paymentFailed('Pay button not found'),
            })
          );
          yield* _(Effect.sleep('2 seconds'));
          yield* _(wrapPromise(page.tap('a.pay-botton')));
          yield* _(
            Effect.tryPromise({
              try: () => page.waitForFunction('window.location.href.includes("payways")', { timeout: 30000 }),
              catch: () => RechargeError.paymentFailed('Timeout waiting for payment methods'),
            })
          );
          yield* _(
            Effect.tryPromise({
              try: () => page.waitForSelector('a.item-link.item-content', { timeout: 15000, visible: true }),
              catch: () => RechargeError.paymentFailed('Payment methods not found'),
            })
          );

          const links = yield* _(wrapPromise(page.$$('a.item-link.item-content')));
          const paymentMethods: Array<{ index: number; name: string }> = [];
          for (let i = 0; i < links.length; i++) {
            const text = yield* _(
              wrapPromise(
                links[i].evaluate((el: unknown) => (el as { textContent?: string }).textContent?.trim().replace(/\n/g, ' ') || '')
              )
            );
            paymentMethods.push({ index: i, name: text });
          }

          return { ...sessionData, selectedAmountIndex: amountIndex, paymentMethods };
        }),

      selectPaymentMethod: (sessionData: RechargeSessionData, methodIndex: number) =>
        Effect.gen(function* (_) {
          const { session } = sessionData;
          const page = session.page;

          let payUrl = '';
          yield* _(wrapPromise(page.setRequestInterception(true)));

          const requestHandler = (request: unknown) => {
            const req = request as { url: () => string; abort: () => Promise<void>; continue: () => Promise<void> };
            const url = req.url();
            for (const pattern of PAY_URL_PATTERNS) {
              if (pattern.test(url)) {
                payUrl = url;
                req.abort().catch(() => {});
                return;
              }
            }
            req.continue().catch(() => {});
          };

          page.on('request', requestHandler);

          const links = yield* _(wrapPromise(page.$$('a.item-link.item-content')));
          yield* _(wrapPromise(links[methodIndex].tap()));

          let attempts = 0;
          while (!payUrl && attempts < 90) {
            yield* _(Effect.sleep('500 millis'));
            attempts++;
          }

          page.off('request', requestHandler);
          if (!payUrl) {
            return yield* _(Effect.fail(RechargeError.paymentFailed('Payment URL timeout')));
          }

          return payUrl;
        }),

      closeSession: (sessionData: RechargeSessionData) =>
        browser.closeSession(sessionData.session).pipe(
          Effect.mapError(() => RechargeError.paymentFailed('Failed to close browser session'))
        ),
    });
  })
);