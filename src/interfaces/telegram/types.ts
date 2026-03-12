/**
 * Telegram Interface - Types
 */

import type { FeeType, ThresholdConfig } from '../../domain/fee';

export interface SessionData {
  setupStep?: 'url' | 'thresholds' | 'interval';
  feeUrl?: string;
  thresholds?: Partial<Record<FeeType, number>>;
  thresholdIndex?: number;
  rechargeSessionId?: string;
  settingsKey?: string;
}