/**
 * SSO Application Service
 */

import { Context, Effect, Layer, Schedule } from 'effect';
import type { DurationInput } from 'effect/Duration';
import type { BrowserSessionState } from '../../infrastructure/browser';
import { BrowserService } from '../../infrastructure/browser';
import { SsoError } from '../../shared/errors';

const BASE_URL = 'https://my.zcst.edu.cn';
const SSO_HOSTS = new Set(['sos.zcst.edu.cn']);
const APP_VERSION = '1.3.7';
const CLIENT_TYPE = 'android';
const TARGET_APP_URL = 'https://sos.zcst.edu.cn/login?service=https%3A%2F%2Fhub.17wanxiao.com%2Fbsacs%2Flight.action%3Fflag%3Dcassso_zhkjxysdZ%26ecardFunc%3Dindex';
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36 iPortal/30';

interface SsoConfig {
  deviceKey: string;
  miSsl: string;
  miHost: string;
}

export interface SsoService {
  readonly fetchFeeUrl: (username: string, password: string) => Effect.Effect<string, SsoError>;
}

export const SsoService = Context.GenericTag<SsoService>('SsoService');

const initClientConfig = (): Effect.Effect<SsoConfig, SsoError> =>
  Effect.gen(function* (_) {
    const deviceKey = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const url = `${BASE_URL}/mobile/initClientConfig21_1.mo`;
    const data = new URLSearchParams({
      deviceKey,
      version: APP_VERSION,
      clientType: CLIENT_TYPE,
      isFirst: '1',
      os: '12',
      mobileType: 'Pixel 6',
    });

    const response = yield* _(
      Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
            body: data.toString(),
          }),
        catch: () => SsoError.serverError(),
      })
    );

    if (!response.ok) {
      return yield* _(Effect.fail(SsoError.serverError()));
    }

    const result = (yield* _(
      Effect.tryPromise({
        try: () => response.json() as Promise<unknown>,
        catch: () => SsoError.serverError(),
      })
    )) as { result?: unknown; failReason?: string; data?: { config?: unknown } | unknown };

    if (String(result.result) !== '1') {
      return yield* _(Effect.fail(SsoError.loginFailed(result.failReason || 'Server initialization failed')));
    }

    const configData = (result.data as { config?: unknown } | undefined)?.config || result.data || {};
    const config = configData as Record<string, unknown>;

    return {
      deviceKey,
      miSsl: (config.mi_sll as string) || (config.mi_ssl as string) || '',
      miHost: (config.mi_host as string) || (config.MI_Host as string) || '',
    };
  });

type PageElement = { 
  $: (selector: string) => Promise<unknown>; 
  $$: (selector: string) => Promise<unknown[]>;
  url: () => string;
};

type Element = {
  isIntersectingViewport: () => Promise<boolean>;
  evaluate: (fn: (el: unknown) => string) => Promise<string>;
  click: () => Promise<void>;
  type: (text: string, opts?: { delay: number }) => Promise<void>;
};

const findVisibleElement = (
  page: PageElement, 
  selectors: string[]
): Effect.Effect<unknown | null, never> =>
  Effect.gen(function* (_) {
    for (const selector of selectors) {
      const element = yield* _(
        Effect.promise(() => page.$(selector)).pipe(
          Effect.catchAll(() => Effect.succeed(null))
        )
      );
      if (element) {
        const isVisible = yield* _(
          Effect.promise(() => (element as Element).isIntersectingViewport()).pipe(
            Effect.catchAll(() => Effect.succeed(false))
          )
        );
        if (isVisible) return element;
      }
    }
    return null;
  });

const waitForElement = (
  page: PageElement,
  selectors: string[],
  options?: { timeout?: DurationInput; interval?: DurationInput }
): Effect.Effect<unknown, SsoError> => {
  const timeout = options?.timeout ?? '30 seconds';
  const interval = options?.interval ?? '500 millis';
  
  const schedule = Schedule.fixed(interval).pipe(
    Schedule.upTo(timeout)
  );

  return findVisibleElement(page, selectors).pipe(
    Effect.filterOrFail(
      (el) => el !== null,
      () => SsoError.loginFailed('Element not found')
    ),
    Effect.retry(schedule)
  );
};

const checkLoginStatus = (
  page: PageElement
): Effect.Effect<{ success: boolean; error?: string }, never> =>
  Effect.gen(function* (_) {
    const currentUrl = page.url();
    const host = new URL(currentUrl).hostname;
    
    if (!SSO_HOSTS.has(host)) {
      return { success: true };
    }

    const errorSelectors = ['.error-msg', '.login-error', '.alert-danger'];
    for (const selector of errorSelectors) {
      const errorEl = yield* _(
        Effect.promise(() => page.$(selector)).pipe(
          Effect.catchAll(() => Effect.succeed(null))
        )
      );
      if (errorEl) {
        const isVisible = yield* _(
          Effect.promise(() => (errorEl as Element).isIntersectingViewport()).pipe(
            Effect.catchAll(() => Effect.succeed(false))
          )
        );
        if (isVisible) {
          const errorText = yield* _(
            Effect.promise(() => (errorEl as Element).evaluate((el) => (el as { textContent?: string }).textContent || '')).pipe(
              Effect.catchAll(() => Effect.succeed(''))
            )
          );
          if (errorText.trim()) {
            return { success: false, error: errorText.trim() };
          }
        }
      }
    }

    return { success: false };
  });

const waitForLoginComplete = (
  page: PageElement,
  timeout: DurationInput = '60 seconds'
): Effect.Effect<void, SsoError> => {
  const schedule = Schedule.fixed('1 second').pipe(
    Schedule.upTo(timeout)
  );

  return checkLoginStatus(page).pipe(
    Effect.filterOrElse(
      (status) => status.success,
      (status) => 
        status.error 
          ? Effect.fail(SsoError.loginFailed(status.error))
          : Effect.fail(SsoError.loginFailed('Waiting...'))
    ),
    Effect.retry(schedule),
    Effect.mapError(() => SsoError.loginFailed('Login timeout'))
  );
};

const waitForTargetUrl = (
  page: PageElement,
  patterns: string[],
  timeout: DurationInput = '40 seconds'
): Effect.Effect<string, SsoError> => {
  const schedule = Schedule.fixed('1 second').pipe(
    Schedule.upTo(timeout)
  );

  return Effect.sync(() => {
    const currentUrl = page.url();
    for (const pattern of patterns) {
      if (currentUrl.includes(pattern)) {
        return currentUrl;
      }
    }
    return null;
  }).pipe(
    Effect.filterOrFail(
      (url): url is string => url !== null,
      () => SsoError.urlNotFound()
    ),
    Effect.retry(schedule)
  );
};

export const SsoServiceLive = Layer.effect(
  SsoService,
  Effect.gen(function* (_) {
    const browser = yield* _(BrowserService);

    return SsoService.of({
      fetchFeeUrl: (username: string, password: string): Effect.Effect<string, SsoError> =>
        Effect.gen(function* (_) {
          const config = yield* _(initClientConfig());
          const idsBase = config.miSsl || config.miHost || BASE_URL;
          const casLoginUrl = `${idsBase}/_web/appWebLogin.jsp`;
          const params = new URLSearchParams({
            serialNo: config.deviceKey,
            os: CLIENT_TYPE,
            deviceName: 'Pixel 6',
            name: 'Pixel 6',
            apnsKey: '',
            miApnsKey: '',
            _p: 'YXM9MTAwMDAwMCZwPTEmbT1OJg__',
          });
          const fullLoginUrl = `${casLoginUrl}?${params.toString()}`;

          const session = yield* _(
            browser.createSession().pipe(
              Effect.mapError(() => SsoError.serverError())
            )
          );

          const result = yield* _(
            Effect.gen(function* (_) {
              const { page } = session;

              yield* _(
                browser.navigateTo(session.page, fullLoginUrl).pipe(
                  Effect.mapError(() => SsoError.loginFailed('Failed to load login page'))
                )
              );

              const passwordSelectors = [
                "input[type='password']",
                "input[placeholder*='密码']",
                "input[name='password']",
                'input#password',
              ];

              const passwordField = yield* _(
                waitForElement(page, passwordSelectors, { timeout: '30 seconds', interval: '500 millis' })
              );

              const tabSelectors = ['[class*="tab-item"]', '[class*="login-tab"]', '[class*="way-item"]', '[class*="login-way"]'];
              for (const selector of tabSelectors) {
                const tabs = yield* _(
                  Effect.promise(() => page.$$(selector)).pipe(
                    Effect.catchAll(() => Effect.succeed([]))
                  )
                );
                for (const tab of tabs) {
                  const text = yield* _(
                    Effect.promise(() => (tab as Element).evaluate((el) => (el as { textContent?: string }).textContent || '')).pipe(
                      Effect.catchAll(() => Effect.succeed(''))
                    )
                  );
                  if (['用户名', '密码', '账号'].some((kw) => text.includes(kw))) {
                    yield* _(
                      Effect.promise(() => (tab as Element).click()).pipe(
                        Effect.catchAll(() => Effect.void)
                      )
                    );
                    yield* _(Effect.sleep('500 millis'));
                    break;
                  }
                }
              }

              const usernameSelectors = [
                "input[placeholder*='账号']",
                "input[placeholder*='用户名']",
                "input[placeholder*='学号']",
                "input[placeholder*='工号']",
                "input[name='username']",
                'input#username',
              ];

              const usernameField = yield* _(
                findVisibleElement(page, usernameSelectors)
              );

              if (!usernameField) {
                return yield* _(Effect.fail(SsoError.loginFailed('Username field not found')));
              }

              yield* _(
                Effect.promise(() => (usernameField as Element).type(username, { delay: 50 })).pipe(
                  Effect.catchAll(() => Effect.void)
                )
              );
              yield* _(
                Effect.promise(() => (passwordField as Element).type(password, { delay: 50 })).pipe(
                  Effect.catchAll(() => Effect.void)
                )
              );

              const submitSelectors = [
                "button[type='submit']",
                "input[type='submit']",
                "button[class*='login']",
                "button[class*='submit']",
                '.login-btn',
                '.submit-btn',
              ];

              let submitBtn = yield* _(findVisibleElement(page, submitSelectors));

              if (!submitBtn) {
                const buttons = yield* _(
                  Effect.promise(() => page.$$('button')).pipe(
                    Effect.catchAll(() => Effect.succeed([]))
                  )
                );
                for (const btn of buttons) {
                  const text = yield* _(
                    Effect.promise(() => (btn as Element).evaluate((el) => (el as { textContent?: string }).textContent || '')).pipe(
                      Effect.catchAll(() => Effect.succeed(''))
                    )
                  );
                  const isVisible = yield* _(
                    Effect.promise(() => (btn as Element).isIntersectingViewport()).pipe(
                      Effect.catchAll(() => Effect.succeed(false))
                    )
                  );
                  if (text.includes('登录') && isVisible) {
                    submitBtn = btn;
                    break;
                  }
                }
              }

              if (!submitBtn) {
                return yield* _(Effect.fail(SsoError.loginFailed('Login button not found')));
              }

              yield* _(
                Effect.promise(() => (submitBtn as Element).click()).pipe(
                  Effect.catchAll(() => Effect.void)
                )
              );

              yield* _(waitForLoginComplete(page));

              yield* _(
                browser.navigateTo(session.page, TARGET_APP_URL).pipe(
                  Effect.catchAll(() => Effect.void)
                )
              );

              const feeUrl = yield* _(
                waitForTargetUrl(page, ['params=', 'xqh5.17wanxiao.com'], '40 seconds')
              );

              return feeUrl;
            }).pipe(
              Effect.ensuring(
                browser.closeSession(session).pipe(
                  Effect.catchAll(() => Effect.void)
                )
              )
            )
          );

          return result;
        }),
    });
  })
);