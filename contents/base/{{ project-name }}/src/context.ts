{% if persistence ~= 'None' %}import { getDb } from './persistence/init';
{% endif %}{% if cache ~= 'None' %}import { getCache } from './resources/cache';
{% endif %}{% if messaging ~= 'None' %}import { getProducer } from './resources/messaging';
{% endif %}import type { AppContext } from './schema';

export async function createContext(): Promise<AppContext> {
  const ctx: AppContext = {};
{% if persistence ~= 'None' %}  try { ctx.db = getDb(); } catch { /* not initialized */ }
{% endif %}{% if cache ~= 'None' %}  try { ctx.cache = getCache(); } catch { /* not initialized */ }
{% endif %}{% if messaging ~= 'None' %}  try { ctx.producer = getProducer(); } catch { /* not initialized */ }
{% endif %}  return ctx;
}
