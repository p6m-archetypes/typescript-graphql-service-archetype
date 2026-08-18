import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { items } from './schema';
import { getDb } from './init';

// Persisted GraphQL resolvers over the `items` scaffold table (src/persistence/schema.ts) —
// the persistence round trip a black-box test can drive. Writes generate ids in JS and read
// back after the write so the resolvers stay dialect-portable (MySQL has no RETURNING clause).
// Replace alongside src/persistence/schema.ts when you add your real model.
export const resolvers = {
  Query: {
    health: () => 'OK',
    {{ entityName }}: async (_parent: unknown, { id }: { id: string }) => {
      const [item] = await getDb().select().from(items).where(eq(items.id, id));
      return item ?? null;
    },
    {{ entityName }}s: async () =>
      getDb().select().from(items).orderBy(items.createdAt),
  },
  Mutation: {
    create{{ EntityName }}: async (_parent: unknown, { displayName }: { displayName: string }) => {
      const db = getDb();
      const id = randomUUID();
      await db.insert(items).values({ id, displayName });
      const [item] = await db.select().from(items).where(eq(items.id, id));
      return item;
    },
    update{{ EntityName }}: async (_parent: unknown, { id, displayName }: { id: string; displayName: string }) => {
      const db = getDb();
      const [existing] = await db.select().from(items).where(eq(items.id, id));
      if (!existing) return null;
      await db.update(items).set({ displayName }).where(eq(items.id, id));
      const [item] = await db.select().from(items).where(eq(items.id, id));
      return item ?? null;
    },
    delete{{ EntityName }}: async (_parent: unknown, { id }: { id: string }) => {
      const db = getDb();
      const [existing] = await db.select().from(items).where(eq(items.id, id));
      if (!existing) return false;
      await db.delete(items).where(eq(items.id, id));
      return true;
    },
  },
};
