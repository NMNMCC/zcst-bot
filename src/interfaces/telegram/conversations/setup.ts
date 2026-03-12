/**
 * Telegram Interface - Setup Conversation
 */

import { Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import { conversations, createConversation, type Conversation, type ConversationFlavor } from '@grammyjs/conversations';
import { Effect } from 'effect';
import { Bot } from 'grammy';
import type { Env } from '../../../shared/types';
import type { FeeType, Balances, ThresholdConfig } from '../../../domain/fee';
import { FEE_TYPE_INFO, DEFAULT_THRESHOLDS, THRESHOLD_STEPS, DEFAULT_CHECK_INTERVAL, MIN_CHECK_INTERVAL } from '../../../domain/fee';
import { AppLayer, type AppServices, DatabaseService, FeeFetcherService, SsoService } from '../../../application';
import type { SessionData } from '../types';
import { formatHelpMessage, formatBalanceMessage, formatSetupWelcome } from '../messages';
import { createSetupUrlKeyboard, createSkipKeyboard, createSkipIntervalKeyboard } from '../keyboards';

type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor<Context>;

export function createSetupConversation(env: Env) {
  return async (conversation: Conversation<BotContext, BotContext>, ctx: BotContext) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const runEffect = <A, E>(effect: Effect.Effect<A, E, AppServices>) =>
      Effect.runPromise(effect.pipe(Effect.provide(AppLayer(env))));

    const db = await runEffect(Effect.map(DatabaseService, (s) => s));
    const feeFetcher = await runEffect(Effect.map(FeeFetcherService, (s) => s));
    const sso = await runEffect(Effect.map(SsoService, (s) => s));

    const user = await conversation.external(() =>
      Effect.runPromise(db.getUser(userId).pipe(Effect.provide(AppLayer(env))))
    );

    if (user?.feeUrl) {
      await ctx.reply(formatHelpMessage(), { parse_mode: 'Markdown' });
      return;
    }

    await ctx.reply(formatSetupWelcome(), {
      parse_mode: 'Markdown',
      reply_markup: createSetupUrlKeyboard(),
    });

    const urlResponse = await conversation.waitFor(['callback_query:data', 'message:text']);

    let feeUrl: string;
    let saveUrl = true;

    if (urlResponse.callbackQuery) {
      const data = urlResponse.callbackQuery.data;
      await urlResponse.answerCallbackQuery();

      if (data === 'setup_paste_url') {
        await ctx.reply('🔗 请发送你的 17wanxiao 查询链接\n\n从学校公众号/小程序获取宿舍费用链接后直接粘贴发送。\n\n发送 /cancel 取消。');
        const urlMsg = await conversation.waitFor('message:text');
        feeUrl = urlMsg.message.text.trim();
      } else if (data === 'setup_sso' || data === 'setup_sso_link_only') {
        saveUrl = data === 'setup_sso';

        await ctx.reply('🔑 *SSO 统一认证登录*\n\n请发送你的 SSO 账号（学号/工号）：\n\n发送 /cancel 取消。', { parse_mode: 'Markdown' });
        const usernameMsg = await conversation.waitFor('message:text');
        const username = usernameMsg.message.text.trim();

        await ctx.reply('🔒 请发送 SSO 密码：\n\n（密码将在读取后立即从聊天记录中删除，不会被存储）');
        const passwordMsg = await conversation.waitFor('message:text');
        const password = passwordMsg.message.text.trim();

        await ctx.api.deleteMessage(ctx.chat!.id, passwordMsg.message.message_id).catch(() => {});

        const loadingMsg = await ctx.reply('⏳ 正在通过 SSO 登录并获取链接，请稍候…\n（此过程可能需要 30-60 秒）');

        feeUrl = await conversation.external(() =>
          Effect.runPromise(sso.fetchFeeUrl(username, password).pipe(Effect.provide(AppLayer(env))))
        );
        await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, '✅ 链接已获取，正在验证有效性…');
      } else {
        return;
      }
    } else {
      feeUrl = urlResponse.message.text.trim();
    }

    const balances = await conversation.external(() =>
      Effect.runPromise(feeFetcher.fetchBalances(feeUrl).pipe(Effect.provide(AppLayer(env))))
    );

    if (!balances || Object.keys(balances).length === 0) {
      await ctx.reply('❌ 无法获取余额数据，链接可能无效或已过期。\n\n请重新发送正确的链接：');
      return;
    }

    if (!saveUrl) {
      await ctx.reply(`✅ *链接获取成功！*\n\n\`${feeUrl}\`\n\n可以直接在浏览器中打开此链接查询水电费。`, { parse_mode: 'Markdown' });
      return;
    }

    await conversation.external(() =>
      Effect.runPromise(
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          yield* _(db.updateUserUrl(userId, feeUrl));
          yield* _(db.updateUserCache(userId, balances));
        }).pipe(Effect.provide(AppLayer(env)))
      )
    );

    const balanceLines = ['✅ 链接验证成功！当前余额：\n'];
    for (const [key, info] of Object.entries(FEE_TYPE_INFO)) {
      const feeKey = key as FeeType;
      const { label, unit } = info;
      const value = balances[feeKey];
      if (value !== undefined) balanceLines.push(`  ${label}：${value.toFixed(2)} ${unit}`);
    }

    const currentThresholds: ThresholdConfig = { ...DEFAULT_THRESHOLDS };

    for (let i = 0; i < THRESHOLD_STEPS.length; i++) {
      const feeType = THRESHOLD_STEPS[i];
      const { label, unit } = FEE_TYPE_INFO[feeType];

      const msg = i === 0
        ? `${balanceLines.join('\n')}\n\n📊 *第 2 步*：设置预警阈值\n\n请发送 ${label} 的预警阈值（${unit}）\n当前值：${currentThresholds[feeType]}`
        : `✅ ${FEE_TYPE_INFO[THRESHOLD_STEPS[i - 1]].label} 预警阈值已设为 ${currentThresholds[THRESHOLD_STEPS[i - 1]]}\n\n请发送 ${label} 的预警阈值（${unit}）\n当前值：${currentThresholds[feeType]}`;

      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: createSkipKeyboard(i) });

      const thresholdResponse = await conversation.waitFor(['message:text', 'callback_query:data']);

      if (thresholdResponse.callbackQuery) {
        await thresholdResponse.answerCallbackQuery();
      } else {
        const value = parseFloat(thresholdResponse.message.text.trim());
        if (!isNaN(value) && value >= 0) currentThresholds[feeType] = value;
      }
    }

    await conversation.external(() =>
      Effect.runPromise(
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          for (const [key, value] of Object.entries(currentThresholds)) {
            yield* _(db.updateUserThreshold(userId, key as FeeType, value));
          }
        }).pipe(Effect.provide(AppLayer(env)))
      )
    );

    await ctx.reply(
      `✅ ${FEE_TYPE_INFO[THRESHOLD_STEPS[THRESHOLD_STEPS.length - 1]].label} 预警阈值已设为 ${currentThresholds[THRESHOLD_STEPS[THRESHOLD_STEPS.length - 1]]}\n\n` +
      `⏱ *第 3 步*：设置定时刷新间隔\n\n当前值：${DEFAULT_CHECK_INTERVAL} 秒\n最小 ${MIN_CHECK_INTERVAL} 秒，设为 0 关闭定时刷新。`,
      { parse_mode: 'Markdown', reply_markup: createSkipIntervalKeyboard() }
    );

    const intervalResponse = await conversation.waitFor(['message:text', 'callback_query:data']);

    let interval = DEFAULT_CHECK_INTERVAL;
    if (intervalResponse.callbackQuery) {
      await intervalResponse.answerCallbackQuery();
    } else {
      const value = parseInt(intervalResponse.message.text.trim());
      if (!isNaN(value) && (value === 0 || value >= MIN_CHECK_INTERVAL)) interval = value;
    }

    await conversation.external(() =>
      Effect.runPromise(
        Effect.gen(function* (_) {
          const db = yield* _(DatabaseService);
          yield* _(db.updateUserCheckInterval(userId, interval));
        }).pipe(Effect.provide(AppLayer(env)))
      )
    );

    await ctx.reply(
      '🎉 *配置完成！*\n\n现在可以使用以下命令：\n/balance — 查询余额\n/update — 刷新余额\n/charge — 充值\n/settings — 修改设置\n/cancel — 取消当前操作',
      { parse_mode: 'Markdown' }
    );
  };
}