import Fastify, { type FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import persistencePlugin from '../plugins/persistence';

// The resource library ships the connection as a Fastify plugin (src/plugins/persistence.ts,
// decorating `fastify.db` from the discrete DB_* settings). The GraphQL server itself runs on
// plain node:http, so a headless Fastify instance hosts the plugin purely as the connection's
// lifecycle container: `initDb()` opens it (and bootstraps the scaffold schema), `getDb()` hands
// it to resolvers, `closeDb()` releases it via the plugin's onClose hook.
export type Db = FastifyInstance['db'];

let holder: FastifyInstance | undefined;

export async function initDb(): Promise<Db> {
  const app = Fastify({ logger: false });
  await app.register(persistencePlugin);
  await app.ready();
  await ensureSchema(app.db);
  holder = app;
  return app.db;
}

export function getDb(): Db {
  if (!holder) {
    throw new Error('Persistence is not initialized — initDb() runs during startup (src/index.ts)');
  }
  return holder.db;
}

export async function closeDb(): Promise<void> {
  if (holder) {
    const app = holder;
    holder = undefined;
    await app.close();
  }
}

// Bootstrap the scaffold schema at startup (the EnsureCreated equivalent).
// Replace with real migrations (drizzle-kit) as your domain solidifies.
async function ensureSchema(db: Db): Promise<void> {
{% if persistence == 'PostgreSQL' %}
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS {{ entity_name }}s (
      id varchar(36) PRIMARY KEY,
      display_name varchar(255) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
{% else %}
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS {{ entity_name }}s (
      id varchar(36) PRIMARY KEY,
      display_name varchar(255) NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
{% endif %}
}
