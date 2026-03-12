/**
 * Error Types - Domain errors using Effect's Data.TaggedError
 */

import { Data } from 'effect';

export class BotError extends Data.TaggedError('BotError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {
  static from(error: unknown, message?: string) {
    return new BotError({
      message: message ?? (error instanceof Error ? error.message : String(error)),
      cause: error,
    });
  }
}

export class ConfigError extends Data.TaggedError('ConfigError')<{
  readonly message: string;
  readonly field?: string;
}> {
  static missing(field: string) {
    return new ConfigError({
      message: `Missing required configuration: ${field}`,
      field,
    });
  }

  static invalid(field: string, reason: string) {
    return new ConfigError({
      message: `Invalid configuration for ${field}: ${reason}`,
      field,
    });
  }
}

export class BrowserError extends Data.TaggedError('BrowserError')<{
  readonly message: string;
  readonly url?: string;
  readonly step?: string;
}> {
  static connectionFailed(url: string) {
    return new BrowserError({
      message: `Failed to connect to browser for URL: ${url}`,
      url,
    });
  }

  static pageLoadFailed(url: string, reason?: string) {
    return new BrowserError({
      message: `Page load failed: ${reason ?? 'unknown error'}`,
      url,
      step: 'page_load',
    });
  }

  static elementNotFound(selector: string, step?: string) {
    return new BrowserError({
      message: `Element not found: ${selector}`,
      step,
    });
  }

  static sessionExpired() {
    return new BrowserError({
      message: 'Browser session expired or not found',
    });
  }

  static timeout(operation: string, ms: number) {
    return new BrowserError({
      message: `Operation "${operation}" timed out after ${ms}ms`,
    });
  }
}

export class FeeFetcherError extends Data.TaggedError('FeeFetcherError')<{
  readonly message: string;
  readonly url?: string;
}> {
  static invalidUrl(url: string) {
    return new FeeFetcherError({
      message: 'Invalid or expired 17wanxiao URL',
      url,
    });
  }

  static noData(url: string) {
    return new FeeFetcherError({
      message: 'No balance data found in API responses',
      url,
    });
  }

  static networkError(url: string, cause?: unknown) {
    return new FeeFetcherError({
      message: `Network error while fetching: ${cause instanceof Error ? cause.message : String(cause)}`,
      url,
    });
  }
}

export class SsoError extends Data.TaggedError('SsoError')<{
  readonly message: string;
}> {
  static invalidCredentials() {
    return new SsoError({
      message: 'Invalid username or password',
    });
  }

  static loginFailed(reason?: string) {
    return new SsoError({
      message: `SSO login failed: ${reason ?? 'unknown error'}`,
    });
  }

  static urlNotFound() {
    return new SsoError({
      message: 'Failed to retrieve fee URL after SSO login',
    });
  }

  static serverError() {
    return new SsoError({
      message: 'School server is unavailable or returned an error',
    });
  }
}

export class RechargeError extends Data.TaggedError('RechargeError')<{
  readonly message: string;
  readonly step?: string;
}> {
  static noSession() {
    return new RechargeError({
      message: 'No active recharge session',
    });
  }

  static invalidFeeType(type: string) {
    return new RechargeError({
      message: `Invalid fee type: ${type}`,
      step: 'type_selection',
    });
  }

  static noAmounts() {
    return new RechargeError({
      message: 'No recharge amounts available',
      step: 'amount_selection',
    });
  }

  static paymentFailed(reason?: string) {
    return new RechargeError({
      message: `Payment URL generation failed: ${reason ?? 'unknown error'}`,
      step: 'payment_generation',
    });
  }
}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly message: string;
  readonly operation?: string;
}> {
  static queryFailed(operation: string, cause?: unknown) {
    return new DatabaseError({
      message: `Database query failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      operation,
    });
  }

  static notFound(table: string, id: string) {
    return new DatabaseError({
      message: `${table} not found with id: ${id}`,
    });
  }
}

export class UserError extends Data.TaggedError('UserError')<{
  readonly message: string;
  readonly telegramId?: string;
}> {
  static notConfigured(telegramId: string) {
    return new UserError({
      message: 'User has not configured their fee URL. Please use /start to set up.',
      telegramId,
    });
  }

  static notFound(telegramId: string) {
    return new UserError({
      message: `User not found: ${telegramId}`,
      telegramId,
    });
  }
}

export class TelegramError extends Data.TaggedError('TelegramError')<{
  readonly message: string;
}> {
  static sendMessageFailed(chatId: string | number, reason?: string) {
    return new TelegramError({
      message: `Failed to send message to ${chatId}: ${reason ?? 'unknown error'}`,
    });
  }

  static webhookSetupFailed(reason?: string) {
    return new TelegramError({
      message: `Webhook setup failed: ${reason ?? 'unknown error'}`,
    });
  }
}