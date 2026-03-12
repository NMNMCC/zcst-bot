/**
 * Config Application Service
 */

import { Context, Effect, Layer } from 'effect';
import type { Env } from '../../shared/types';
import { ConfigError } from '../../shared/errors';

export interface ConfigService {
  readonly telegramBotToken: Effect.Effect<string, ConfigError>;
  readonly environment: Effect.Effect<string, never>;
  readonly isDevelopment: Effect.Effect<boolean, never>;
  readonly isProduction: Effect.Effect<boolean, never>;
  readonly getEnv: <T extends keyof Env>(key: T) => Effect.Effect<Env[T], never>;
}

export const ConfigService = Context.GenericTag<ConfigService>('ConfigService');

export const makeConfigService = (env: Env): ConfigService => ({
  telegramBotToken: Effect.gen(function* (_) {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return yield* _(Effect.fail(ConfigError.missing('TELEGRAM_BOT_TOKEN')));
    }
    return token;
  }),

  environment: Effect.succeed(env.ENVIRONMENT ?? 'development'),

  isDevelopment: Effect.succeed((env.ENVIRONMENT ?? 'development') === 'development'),

  isProduction: Effect.succeed(env.ENVIRONMENT === 'production'),

  getEnv: <T extends keyof Env>(key: T) => Effect.succeed(env[key]),
});

export const ConfigLayer = (env: Env) => Layer.succeed(ConfigService, makeConfigService(env));