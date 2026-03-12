/**
 * Telegram Interface - Bot Factory
 */

import { Bot, Context, session, SessionFlavor } from 'grammy';
import { conversations, createConversation, type ConversationFlavor } from '@grammyjs/conversations';
import type { Env } from '../../shared/types';
import type { SessionData } from './types';
import { createSetupConversation } from './conversations';
import {
  createBalanceCommand,
  createUpdateCommand,
  createSettingsCommand,
  createLinkCommand,
  createCancelCommand,
  createDoneCallback,
  createResetCallback,
  createResetConfirmCallback,
  createSettingsBackCallback,
  createCloseCallback,
} from './commands';

type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor<Context>;

export function createBot(token: string, env: Env): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  bot.use(session({ initial: (): SessionData => ({}) }));
  bot.use(conversations());
  bot.use(createConversation(createSetupConversation(env), 'setup'));

  bot.command('start', async (ctx) => {
    await ctx.conversation.enter('setup');
  });

  bot.command('balance', createBalanceCommand(env));
  bot.command('update', createUpdateCommand(env));
  bot.command('settings', createSettingsCommand(env));
  bot.command('link', createLinkCommand(env));
  bot.command('cancel', createCancelCommand());

  bot.callbackQuery('done', createDoneCallback());
  bot.callbackQuery('reset', createResetCallback(env));
  bot.callbackQuery('reset_confirm', createResetConfirmCallback(env));
  bot.callbackQuery('settings_back', createSettingsBackCallback(env));
  bot.callbackQuery('close', createCloseCallback());

  bot.catch((err) => console.error('Bot error:', err));

  return bot;
}

export { type SessionData, type BotContext };