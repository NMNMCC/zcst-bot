/**
 * Application Services - Service Locator
 */

import { Layer } from 'effect';
import type { Env } from '../../shared/types';
import { ConfigService, ConfigLayer } from './config';
import { AppLoggerLayer } from './logger';
import { DatabaseService, DatabaseLayer } from '../../infrastructure/database';
import { BrowserService, BrowserLayer } from '../../infrastructure/browser';
import { FeeFetcherService, FeeFetcherServiceLive } from './fee-fetcher';
import { SsoService, SsoServiceLive } from './sso';
import { RechargeSessionService, RechargeSessionServiceLive } from './recharge-session';

export type AppServices =
  | ConfigService
  | DatabaseService
  | BrowserService
  | FeeFetcherService
  | SsoService
  | RechargeSessionService;

const BaseLayer = (env: Env) =>
  Layer.mergeAll(
    ConfigLayer(env),
    AppLoggerLayer,
    DatabaseLayer(env.DB),
    BrowserLayer(env.BROWSER)
  );

const DerivedLayer = Layer.mergeAll(
  FeeFetcherServiceLive,
  SsoServiceLive,
  RechargeSessionServiceLive
);

export const AppLayer = (env: Env): Layer.Layer<AppServices> => {
  const baseLayer = BaseLayer(env);
  const derivedLayer = DerivedLayer.pipe(Layer.provide(baseLayer));
  return Layer.mergeAll(baseLayer, derivedLayer) as Layer.Layer<AppServices>;
};

export {
  ConfigService,
  DatabaseService,
  BrowserService,
  FeeFetcherService,
  SsoService,
  RechargeSessionService,
};