/**
 * Telegram Interface - Command Handlers
 */

import { Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import { conversations, type ConversationFlavor } from '@grammyjs/conversations';
import { Effect } from 'effect';
import type { Env } from '../../../shared/types';
import { AppLayer, type AppServices, DatabaseService, FeeFetcherService } from '../../../application';
import { DatabaseError, FeeFetcherError } from '../../../shared/errors';
import { DEFAULT_THRESHOLDS } from '../../../domain/fee';
import type { SessionData } from '../types';
import { formatBalanceMessage, formatSettingsMessage } from '../messages';
import { createSettingsKeyboard, createResetConfirmKeyboard } from '../keyboards';

type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor<Context>;

const runEffect = <A, E>(env: Env, effect: Effect.Effect<A, E, AppServices>) =>
  Effect.runPromise(effect.pipe(Effect.provide(AppLayer(env))));

export function createBalanceCommand(env: Env) {
  return async (ctx: BotContext) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    let result;
    try {
      result = await runEffect(env,
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          return yield* _(db.getUser(userId));
        })
      );
    } catch (error) {
      const errorMessage = error instanceof DatabaseError
        ? `❌ 获取用户数据失败：${error.message}`
        : `❌ 获取用户数据失败：${error instanceof Error ? error.message : '未知错误'}`;
      await ctx.reply(errorMessage);
      return;
    }

    if (!result?.feeUrl) {
      await ctx.reply('⚠️ 尚未设置查询链接。\n请先使用 /start 配置。');
      return;
    }

    if (result.cachedBalances) {
      await ctx.reply(
        formatBalanceMessage(result.cachedBalances, result.thresholds ?? DEFAULT_THRESHOLDS, result.cachedAt ?? undefined), 
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply('暂无缓存余额，请使用 /update 刷新。');
    }
  };
}

export function createUpdateCommand(env: Env) {
  return async (ctx: BotContext) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    let user;
    try {
      user = await runEffect(env,
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          return yield* _(db.getUser(userId));
        })
      );
    } catch (error) {
      const errorMessage = error instanceof DatabaseError
        ? `❌ 获取用户数据失败：${error.message}`
        : `❌ 获取用户数据失败：${error instanceof Error ? error.message : '未知错误'}`;
      await ctx.reply(errorMessage);
      return;
    }

    if (!user?.feeUrl) {
      await ctx.reply('⚠️ 尚未设置查询链接。\n请先使用 /start 配置。');
      return;
    }

    const msg = await ctx.reply('⏳ 正在刷新余额…');

    let balances;
    try {
      balances = await runEffect(env,
        Effect.gen(function* (_) {
          const feeFetcher = yield* _(FeeFetcherService);
          return yield* _(feeFetcher.fetchBalances(user.feeUrl!));
        })
      );
    } catch (error) {
      const errorMessage = error instanceof FeeFetcherError
        ? `❌ 刷新余额失败：${error.message}`
        : `❌ 刷新余额失败：${error instanceof Error ? error.message : '未知错误'}`;
      await ctx.api.editMessageText(ctx.chat!.id, msg.message_id, errorMessage);
      return;
    }

    if (!balances || Object.keys(balances).length === 0) {
      await ctx.api.editMessageText(ctx.chat!.id, msg.message_id, '❌ 未能获取余额数据，请检查链接是否过期。');
      return;
    }

    try {
      await runEffect(env,
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          yield* _(db.updateUserCache(userId, balances));
        })
      );
    } catch (error) {
      // 缓存更新失败不影响显示余额，只记录日志
      console.error('Failed to update cache:', error);
    }

    await ctx.api.editMessageText(
      ctx.chat!.id, 
      msg.message_id, 
      formatBalanceMessage(balances, user.thresholds ?? DEFAULT_THRESHOLDS), 
      { parse_mode: 'Markdown' }
    );
  };
}

export function createSettingsCommand(env: Env) {
  return async (ctx: BotContext) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      const user = await runEffect(env,
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          return yield* _(db.getOrCreateUser(userId));
        })
      );

      await ctx.reply(formatSettingsMessage(user), { parse_mode: 'Markdown', reply_markup: createSettingsKeyboard() });
    } catch (error) {
      const errorMessage = error instanceof DatabaseError
        ? `❌ 获取设置失败：${error.message}`
        : `❌ 获取设置失败：${error instanceof Error ? error.message : '未知错误'}`;
      await ctx.reply(errorMessage);
    }
  };
}

export function createLinkCommand(env: Env) {
  return async (ctx: BotContext) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    let user;
    try {
      user = await runEffect(env,
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          return yield* _(db.getUser(userId));
        })
      );
    } catch (error) {
      const errorMessage = error instanceof DatabaseError
        ? `❌ 获取用户数据失败：${error.message}`
        : `❌ 获取用户数据失败：${error instanceof Error ? error.message : '未知错误'}`;
      await ctx.reply(errorMessage);
      return;
    }

    if (user?.feeUrl) {
      await ctx.reply(`🔗 *你的查询链接：*\n\n\`${user.feeUrl}\``, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('⚠️ 尚未设置查询链接。\n请使用 /start 进行配置。');
    }
  };
}

export function createCancelCommand() {
  return async (ctx: BotContext) => {
    ctx.session = {};
    await ctx.reply('✅ 已取消当前操作。');
  };
}

export function createDoneCallback() {
  return async (ctx: BotContext) => {
    await ctx.editMessageText('✅ 设置完成。');
  };
}

export function createResetCallback(env: Env) {
  return async (ctx: BotContext) => {
    await ctx.editMessageText(
      '⚠️ *确认清除所有个人数据？*\n\n链接、阈值、缓存等将全部删除。',
      { parse_mode: 'Markdown', reply_markup: createResetConfirmKeyboard() }
    );
  };
}

export function createResetConfirmCallback(env: Env) {
  return async (ctx: BotContext) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      await runEffect(env,
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          yield* _(db.deleteUser(userId));
        })
      );

      await ctx.editMessageText('✅ 所有个人数据已清除。');
    } catch (error) {
      const errorMessage = error instanceof DatabaseError
        ? `❌ 清除数据失败：${error.message}`
        : `❌ 清除数据失败：${error instanceof Error ? error.message : '未知错误'}`;
      await ctx.editMessageText(errorMessage);
    }
  };
}

export function createSettingsBackCallback(env: Env) {
  return async (ctx: BotContext) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    try {
      const user = await runEffect(env,
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          return yield* _(db.getOrCreateUser(userId));
        })
      );

      await ctx.editMessageText(formatSettingsMessage(user), { parse_mode: 'Markdown', reply_markup: createSettingsKeyboard() });
    } catch (error) {
      const errorMessage = error instanceof DatabaseError
        ? `❌ 获取设置失败：${error.message}`
        : `❌ 获取设置失败：${error instanceof Error ? error.message : '未知错误'}`;
      await ctx.editMessageText(errorMessage);
    }
  };
}

export function createCloseCallback() {
  return async (ctx: BotContext) => {
    await ctx.deleteMessage();
  };
}