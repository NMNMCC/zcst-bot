/**
 * Fee Domain Types - Pure domain types with no external dependencies
 */

/**
 * Supported fee types
 */
export const FEE_TYPES = ['electricity', 'cold_water', 'hot_water'] as const;
export type FeeType = (typeof FEE_TYPES)[number];

/**
 * Balance data for all fee types
 */
export interface Balances {
  electricity?: number;
  cold_water?: number;
  hot_water?: number;
}

/**
 * Fee type display information
 */
export interface FeeTypeInfo {
  label: string;
  unit: string;
  icon: string;
}

/**
 * Fee type to display info mapping
 */
export const FEE_TYPE_INFO: Record<FeeType, FeeTypeInfo> = {
  electricity: { label: '电费', unit: 'kWh', icon: '⚡' },
  cold_water: { label: '冷水', unit: '吨', icon: '🚰' },
  hot_water: { label: '热水', unit: '吨', icon: '♨️' },
};

/**
 * Legacy alias for backwards compatibility
 */
export const FEE_LABELS = FEE_TYPE_INFO;

/**
 * Alert threshold configuration
 */
export interface ThresholdConfig {
  electricity: number;
  cold_water: number;
  hot_water: number;
}

/**
 * Default alert thresholds
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  electricity: 5.0,
  cold_water: 1.0,
  hot_water: 0.5,
};

/**
 * Order of fee types for threshold setup wizard
 */
export const THRESHOLD_STEPS: FeeType[] = ['electricity', 'cold_water', 'hot_water'];

/**
 * Check interval constants
 */
export const DEFAULT_CHECK_INTERVAL = 300; // 5 minutes
export const MIN_CHECK_INTERVAL = 60; // 1 minute