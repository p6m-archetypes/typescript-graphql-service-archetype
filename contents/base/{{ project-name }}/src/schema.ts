import { createSchema } from 'graphql-yoga';
{% if persistence ~= 'None' %}import type { getDb } from './persistence/init';
import { resolvers } from './persistence/resolvers';
{% endif %}{% if cache ~= 'None' %}import type { getCache } from './resources/cache';
{% endif %}{% if messaging ~= 'None' %}import type { getProducer } from './resources/messaging';
{% endif %}
export type AppContext = {
{% if persistence ~= 'None' %}  db?: ReturnType<typeof getDb>;
{% endif %}{% if cache ~= 'None' %}  cache?: ReturnType<typeof getCache>;
{% endif %}{% if messaging ~= 'None' %}  producer?: ReturnType<typeof getProducer>;
{% endif %}};

// The GraphQL surface is the platform standard (S2): entity-named type, prefix-free query
// fields ({{ prefixName }} / {{ prefixName }}s — naive plural), create/update/delete mutations.
export const schema = createSchema<AppContext>({
  typeDefs: `
    type {{ PrefixName }} {
      id: ID!
      displayName: String!
    }

    type Query {
      health: String!
      {{ prefixName }}(id: ID!): {{ PrefixName }}
      {{ prefixName }}s: [{{ PrefixName }}!]!
    }

    type Mutation {
      create{{ PrefixName }}(displayName: String!): {{ PrefixName }}!
      update{{ PrefixName }}(id: ID!, displayName: String!): {{ PrefixName }}
      delete{{ PrefixName }}(id: ID!): Boolean!
    }
  `,
{% if persistence ~= 'None' %}
  // Persisted resolvers over the Item scaffold entity (src/persistence/schema.ts).
  // Replace alongside your real domain model.
  resolvers,
{% else %}
  // In-memory stub resolvers — nothing is persisted. Select a persistence option to render the
  // scaffold CRUD backed by a real database.
  resolvers: {
    Query: {
      health: () => 'OK',
      {{ prefixName }}: (_parent, { id }) => ({ id, displayName: '' }),
      {{ prefixName }}s: () => [],
    },
    Mutation: {
      create{{ PrefixName }}: (_parent, { displayName }) => ({ id: crypto.randomUUID(), displayName }),
      update{{ PrefixName }}: (_parent, { id, displayName }) => ({ id, displayName }),
      delete{{ PrefixName }}: () => false,
    },
  },
{% endif %}
});
