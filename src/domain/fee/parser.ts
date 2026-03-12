/**
 * Fee Domain Parser - Extract balances from API responses
 * Pure domain logic with no external dependencies
 */

import type { Balances, FeeType } from './types';

// ============================================
// Constants for parsing
// ============================================

const ELEC_KEYS = new Set(['elecBalance', 'electricBalance', 'electricityBalance', 'elec_balance', 'elecAmt', 'electricAmt', 'dianfeibalance', 'dianfei']);
const COLD_KEYS = new Set(['coldWaterBalance', 'coldBalance', 'cold_water_balance', 'coldwater_balance', 'coldWaterAmt', 'lengshui']);
const HOT_KEYS = new Set(['hotWaterBalance', 'hotBalance', 'hot_water_balance', 'hotwater_balance', 'hotWaterAmt', 'reshui']);
const ELEC_NAMES = new Set(['电费', '电', '用电', '电量费']);
const COLD_NAMES = new Set(['冷水', '冷水费', '生活冷水', '自来水']);
const HOT_NAMES = new Set(['热水', '热水费', '生活热水', '洗浴热水']);
const BALANCE_KEYS = ['balance', 'amount', 'money', 'fee', 'value', 'amt', '余额', '金额', 'surplusmoney', 'odd'];
const BUSINESSTYPE_MAP: Record<string, FeeType> = { '0': 'electricity', '1': 'cold_water', '2': 'hot_water' };

// ============================================
// Helper Functions
// ============================================

function toFloat(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function tryParseBody(data: unknown): void {
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      data.forEach(tryParseBody);
    } else {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) {
              (data as Record<string, unknown>)[key] = parsed;
              tryParseBody(parsed);
            }
          } catch {
            // Ignore parse errors
          }
        } else if (typeof value === 'object' && value !== null) {
          tryParseBody(value);
        }
      }
    }
  }
}

function parseDetaillist(data: unknown): Partial<Balances> {
  const balances: Partial<Balances> = {};

  function search(obj: unknown): void {
    if (Array.isArray(obj)) {
      obj.forEach(search);
    } else if (typeof obj === 'object' && obj !== null) {
      const record = obj as Record<string, unknown>;
      const detaillist = record.detaillist;
      if (Array.isArray(detaillist)) {
        for (const item of detaillist) {
          if (typeof item !== 'object' || item === null) continue;
          const bt = String((item as Record<string, unknown>).businesstype ?? '').trim();
          const key = BUSINESSTYPE_MAP[bt];
          if (key && !(key in balances)) {
            const val = toFloat((item as Record<string, unknown>).odd);
            if (val !== null) balances[key] = val;
          }
        }
      }
      Object.values(record).forEach(search);
    }
  }

  search(data);
  return balances;
}

function findByKey(data: unknown, keySet: Set<string>): number | null {
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      for (const item of data) {
        const r = findByKey(item, keySet);
        if (r !== null) return r;
      }
    } else {
      for (const [key, value] of Object.entries(data)) {
        if (keySet.has(key) || keySet.has(key.toLowerCase())) {
          const r = toFloat(value);
          if (r !== null) return r;
        }
        const r = findByKey(value, keySet);
        if (r !== null) return r;
      }
    }
  }
  return null;
}

function findByName(data: unknown, nameSet: Set<string>): number | null {
  const nameFields = ['name', 'itemName', 'typeName', 'type', 'title', 'category', 'cateName'];

  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item !== 'object' || item === null) continue;
      for (const nf of nameFields) {
        const raw = String((item as Record<string, unknown>)[nf] ?? '').trim();
        if (raw && (nameSet.has(raw) || [...nameSet].some(n => raw.includes(n)))) {
          for (const bk of BALANCE_KEYS) {
            const r = toFloat((item as Record<string, unknown>)[bk]);
            if (r !== null) return r;
          }
        }
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    for (const value of Object.values(data)) {
      const r = findByName(value, nameSet);
      if (r !== null) return r;
    }
  }
  return null;
}

// ============================================
// Main Parser Function
// ============================================

export interface CapturedResponse {
  url: string;
  status: number;
  data: unknown;
}

/**
 * Extract balance data from captured API responses
 */
export function extractBalancesFromResponses(responses: CapturedResponse[]): Balances {
  const balances: Balances = {};

  for (const resp of responses) {
    tryParseBody(resp.data);
  }

  for (const resp of responses) {
    const dlBalances = parseDetaillist(resp.data);
    Object.assign(balances, dlBalances);
    if (Object.keys(balances).length >= 3) return balances;
  }

  for (const resp of responses) {
    if (!('electricity' in balances)) {
      const e = findByKey(resp.data, ELEC_KEYS) ?? findByName(resp.data, ELEC_NAMES);
      if (e !== null) balances.electricity = e;
    }
    if (!('cold_water' in balances)) {
      const c = findByKey(resp.data, COLD_KEYS) ?? findByName(resp.data, COLD_NAMES);
      if (c !== null) balances.cold_water = c;
    }
    if (!('hot_water' in balances)) {
      const h = findByKey(resp.data, HOT_KEYS) ?? findByName(resp.data, HOT_NAMES);
      if (h !== null) balances.hot_water = h;
    }
    if (Object.keys(balances).length >= 3) break;
  }

  return balances;
}