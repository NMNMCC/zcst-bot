/**
 * Telegram Interface - Inline Keyboards
 */

import { InlineKeyboard } from 'grammy';
import type { FeeType } from '../../../domain/fee';
import { FEE_TYPE_INFO } from '../../../domain/fee';

export function createSettingsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔗 修改链接', 'set_url').text('🔑 SSO 登录', 'set_sso').row()
    .text('⚡ 电费阈值', 'set_threshold_electricity').text('🚰 冷水阈值', 'set_threshold_cold_water').row()
    .text('♨️ 热水阈值', 'set_threshold_hot_water').text('⏱ 刷新间隔', 'set_interval').row()
    .text('🗑 清除所有数据', 'reset').row()
    .text('✅ 完成', 'done');
}

export function createSetupUrlKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔑 SSO 登录获取链接', 'setup_sso').row()
    .text('🔗 手动粘贴链接', 'setup_paste_url').row()
    .text('🔍 SSO 仅获取链接（不保存）', 'setup_sso_link_only');
}

export function createSkipKeyboard(index: number): InlineKeyboard {
  return new InlineKeyboard().text('⏭ 使用默认值', `skip_threshold_${index}`);
}

export function createSkipIntervalKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('⏭ 使用默认值', 'skip_interval');
}

export function createResetConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚠️ 确认清除', 'reset_confirm').row()
    .text('↩️ 返回', 'settings_back');
}