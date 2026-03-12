/**
 * Recharge Domain Types
 */

import type { FeeType, Balances } from '../fee/types';

/**
 * Recharge session step
 */
export type RechargeStep =
  | 'type_selection'
  | 'amount_selection'
  | 'payment_selection'
  | 'payment_pending'
  | 'completed';

/**
 * Available recharge amount
 */
export interface RechargeAmount {
  index: number;
  text: string;
  value?: number;
}

/**
 * Payment method option
 */
export interface PaymentMethod {
  index: number;
  name: string;
}

/**
 * Recharge session state
 */
export interface RechargeState {
  sessionId: string;
  telegramId: string;
  step: RechargeStep;
  feeType?: FeeType;
  amounts?: RechargeAmount[];
  selectedAmountIndex?: number;
  paymentMethods?: PaymentMethod[];
  paymentUrl?: string;
  balanceBefore?: number;
  expiresAt: string;
}

/**
 * Business type to API parameter mapping
 */
export const BUSINESSTYPE_MAP: Record<FeeType, string> = {
  electricity: '0',
  cold_water: '1',
  hot_water: '2',
};

export const BUSINESSTYPE_TO_BUTTON_INDEX: Record<string, number> = {
  '0': 0,
  '1': 1,
  '2': 2,
};

/**
 * Payment URL patterns for detection
 */
export const PAY_URL_PATTERNS = [
  /\/e-pay\/pay\.html\?/i,
  /mclient\.alipay\.com\/h5pay/i,
  /wx\.tenpay\.com/i,
  /pay\.weixin\.qq\.com/i,
];