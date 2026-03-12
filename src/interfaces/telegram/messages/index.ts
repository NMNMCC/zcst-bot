/**
 * Telegram Interface - Message Formatters
 */

import type { Balances, FeeType, ThresholdConfig, FeeTypeInfo } from '../../../domain/fee';
import { FEE_TYPE_INFO } from '../../../domain/fee';

export function formatBalanceMessage(
  balances: Balances, 
  thresholds: ThresholdConfig, 
  updatedAt?: string
): string {
  const lines = ['📊 *当前余额*\n'];

  for (const [key, info] of Object.entries(FEE_TYPE_INFO)) {
    const feeKey = key as FeeType;
    const { label, unit } = info as FeeTypeInfo;
    const value = balances[feeKey];
    if (value !== undefined) {
      const threshold = thresholds[feeKey] ?? 0;
      const warn = value < threshold ? ' ⚠️' : '';
      lines.push(`${label}：\`${value.toFixed(2)}\` ${unit}${warn}`);
    }
  }

  if (updatedAt) lines.push(`\n🕓 更新于 ${updatedAt}`);
  return lines.join('\n');
}

export function formatSettingsMessage(user: { 
  feeUrl: string | null; 
  checkInterval: number | null; 
  thresholds: ThresholdConfig | null 
}): string {
  const urlStatus = user.feeUrl ? '已设置 ✅' : '未设置 ❌';
  const interval = user.checkInterval ?? 300;
  const intervalStatus = interval === 0 ? '（已关闭）' : '';
  const thresholds = user.thresholds ?? { electricity: 5.0, cold_water: 1.0, hot_water: 0.5 };
  
  const lines = [
    '⚙️ *当前设置*\n',
    `🔗 链接：${urlStatus}`,
    `⏱ 刷新间隔：${interval} 秒${intervalStatus}`,
    '\n📊 *预警阈值*',
  ];

  for (const [key, info] of Object.entries(FEE_TYPE_INFO)) {
    const feeKey = key as FeeType;
    const { label, unit } = info as FeeTypeInfo;
    const value = thresholds[feeKey] ?? 0;
    lines.push(`  ${label}：${value} ${unit}`);
  }
  
  return lines.join('\n');
}

export function formatHelpMessage(): string {
  return (
    '👋 *宿舍费用机器人*\n\n' +
    '/balance — 查询余额\n/update — 刷新余额\n/charge — 充值\n/settings — 设置\n/link — 获取查询链接\n/cancel — 取消'
  );
}

export function formatSetupWelcome(): string {
  return (
    '👋 *欢迎使用宿舍费用机器人！*\n\n让我们来完成初始配置。\n\n🔗 *第 1 步*：设置查询链接\n\n请选择获取链接的方式：'
  );
}