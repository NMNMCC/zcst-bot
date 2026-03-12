/**
 * ZCST Fee Bot - Cloudflare Workers Entry Point
 */

import { webhookCallback } from 'grammy';
import { Effect } from 'effect';
import type { Env } from './shared/types';
import { createBot } from './interfaces/telegram';
import { handleScheduled } from './interfaces/scheduled';
import { AppLayer, type AppServices } from './application';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token) return new Response('Bot token not configured', { status: 500 });

    const bot = createBot(token, env);

    try {
      return await webhookCallback(bot, 'cloudflare-mod')(request);
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      Effect.runPromise(
        handleScheduled(env).pipe(
          Effect.provide(AppLayer(env))
        )
      )
    );
  },
} satisfies ExportedHandler<Env>;