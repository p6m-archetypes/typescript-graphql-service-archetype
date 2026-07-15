import './otel';
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';
import { createContext } from './context';
import { serveManagement } from './management';
import { settings } from './settings';
{% if persistence ~= 'None' %}import { initResource as initDb, closeResource as closeDb } from './resources/persistence';
{% endif %}{% if cache ~= 'None' %}import { initResource as initCache, closeResource as closeCache } from './resources/cache';
{% endif %}{% if messaging ~= 'None' %}import { initResource as initMessaging, closeResource as closeMessaging } from './resources/messaging';
{% endif %}{% if has_s3 %}import { initS3 } from './resources/storage-s3';
{% endif %}{% if has_azure_blob %}import { initAzureBlob } from './resources/storage-azure';
{% endif %}
async function main() {
{% if persistence ~= 'None' %}  await initDb();
{% endif %}{% if cache ~= 'None' %}  await initCache();
{% endif %}{% if messaging ~= 'None' %}  await initMessaging();
{% endif %}{% if has_s3 %}  initS3();
{% endif %}{% if has_azure_blob %}  initAzureBlob();
{% endif %}
  const yoga = createYoga({ schema, context: createContext });
  const server = createServer(yoga);

  try {
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        server.listen(settings.port, settings.host, resolve);
        server.on('error', reject);
      }),
      serveManagement(),
    ]);
  } finally {
{% if persistence ~= 'None' %}    await closeDb();
{% endif %}{% if cache ~= 'None' %}    await closeCache();
{% endif %}{% if messaging ~= 'None' %}    await closeMessaging();
{% endif %}  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
