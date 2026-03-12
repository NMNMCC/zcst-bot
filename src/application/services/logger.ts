/**
 * Logger Application Service
 */

import { Layer, Logger, LogLevel } from 'effect';

const appLogger = Logger.make(({ logLevel, message }) => {
  const timestamp = new Date().toISOString();
  const level = logLevel.label;
  const msg = typeof message === 'string' ? message : JSON.stringify(message);
  console.log(`[${timestamp}] [${level}] ${msg}`);
});

export const AppLoggerLayer = Logger.replace(Logger.defaultLogger, appLogger);