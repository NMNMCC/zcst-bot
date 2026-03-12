/**
 * Browser Service Infrastructure - Puppeteer automation
 */

import puppeteer, { type Browser, type Page } from '@cloudflare/puppeteer';
import { Context, Effect, Layer } from 'effect';
import { BrowserError } from '../../shared/errors';

export interface CapturedResponse {
  url: string;
  status: number;
  data: unknown;
}

export interface BrowserSessionState {
  browser: Browser;
  page: Page;
  sessionId: string;
  createdAt: Date;
}

export interface BrowserService {
  readonly createSession: (keepAliveMs?: number) => Effect.Effect<BrowserSessionState, BrowserError>;
  readonly closeSession: (session: BrowserSessionState) => Effect.Effect<void, BrowserError>;
  readonly navigateTo: (page: Page, url: string, waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2') => Effect.Effect<void, BrowserError>;
  readonly captureJsonResponses: (page: Page) => () => CapturedResponse[];
  readonly waitForSelector: (page: Page, selector: string, timeout?: number) => Effect.Effect<void, BrowserError>;
  readonly evaluateScript: <T>(page: Page, fn: () => T) => Effect.Effect<T, BrowserError>;
  readonly tapElement: (page: Page, selector: string) => Effect.Effect<void, BrowserError>;
}

export const BrowserService = Context.GenericTag<BrowserService>('BrowserService');

const BROWSER_SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const PAGE_LOAD_TIMEOUT_MS = 30000;

const makeBrowserService = (browserBinding: Fetcher): BrowserService => {
  const wrapPromise = <T>(operation: string, promise: Promise<T>): Effect.Effect<T, BrowserError> =>
    Effect.tryPromise({
      try: () => promise,
      catch: () => BrowserError.timeout(operation, 30000),
    });

  return {
    createSession: (keepAliveMs = BROWSER_SESSION_TIMEOUT_MS) =>
      Effect.gen(function* (_) {
        const browser = yield* _(wrapPromise(
          'createSession.launch',
          puppeteer.launch(browserBinding, { keep_alive: keepAliveMs })
        ));

        const page = yield* _(wrapPromise(
          'createSession.newPage',
          browser.newPage()
        ));

        yield* _(wrapPromise(
          'createSession.setViewport',
          page.setViewport({ width: 390, height: 844, hasTouch: true })
        ));

        yield* _(wrapPromise(
          'createSession.setUserAgent',
          page.setUserAgent(
            'Mozilla/5.0 (Linux; Android 13; SM-G991B) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/124.0.0.0 Mobile Safari/537.36 ' +
            'MicroMessenger/8.0.44'
          )
        ));

        return {
          browser,
          page,
          sessionId: crypto.randomUUID(),
          createdAt: new Date(),
        };
      }),

    closeSession: (session: BrowserSessionState) =>
      wrapPromise('closeSession', session.browser.close()).pipe(
        Effect.asVoid
      ),

    navigateTo: (page: Page, url: string, waitUntil = 'networkidle2') =>
      Effect.tryPromise({
        try: () => page.goto(url, { waitUntil, timeout: PAGE_LOAD_TIMEOUT_MS }),
        catch: () => BrowserError.pageLoadFailed(url),
      }).pipe(Effect.asVoid),

    captureJsonResponses: (page: Page) => {
      const responses: CapturedResponse[] = [];

      const handler = async (response: unknown) => {
        const resp = response as { url: () => string; status: () => number; headers: () => Record<string, string>; json: () => Promise<unknown> };
        const url = resp.url();
        const status = resp.status();
        const contentType = resp.headers()['content-type'] || '';

        if (status === 200 && contentType.includes('json')) {
          try {
            const data = await resp.json();
            responses.push({ url, status, data });
          } catch {}
        }
      };

      page.on('response', handler);
      return () => {
        page.off('response', handler);
        return responses;
      };
    },

    waitForSelector: (page: Page, selector: string, timeout = 15000) =>
      Effect.tryPromise({
        try: () => page.waitForSelector(selector, { timeout, visible: true }),
        catch: () => BrowserError.elementNotFound(selector, 'waitForSelector'),
      }).pipe(Effect.asVoid),

    evaluateScript: <T>(page: Page, fn: () => T) =>
      wrapPromise('evaluateScript', page.evaluate(fn) as Promise<T>),

    tapElement: (page: Page, selector: string) =>
      Effect.gen(function* (_) {
        const element = yield* _(wrapPromise('tapElement.$', page.$(selector)));
        if (!element) {
          return yield* _(Effect.fail(BrowserError.elementNotFound(selector, 'tapElement')));
        }
        yield* _(wrapPromise('tapElement.tap', element.tap()));
      }),
  };
};

export const BrowserLayer = (browserBinding: Fetcher) => 
  Layer.succeed(BrowserService, makeBrowserService(browserBinding));