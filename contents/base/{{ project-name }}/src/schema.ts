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
// fields ({{ entityName }} / {{ entityName }}s — naive plural), create/update/delete mutations.
export const schema = createSchema<AppContext>({
  typeDefs: `
    type {{ EntityName }} {
      id: ID!
      displayName: String!
    }

    type Query {
      health: String!
      {{ entityName }}(id: ID!): {{ EntityName }}
      {{ entityName }}s: [{{ EntityName }}!]!
    }

    type Mutation {
      create{{ EntityName }}(displayName: String!): {{ EntityName }}!
      update{{ EntityName }}(id: ID!, displayName: String!): {{ EntityName }}
      delete{{ EntityName }}(id: ID!): Boolean!
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
      {{ entityName }}: (_parent, { id }) => ({ id, displayName: '' }),
      {{ entityName }}s: () => [],
    },
    Mutation: {
      create{{ EntityName }}: (_parent, { displayName }) => ({ id: crypto.randomUUID(), displayName }),
      update{{ EntityName }}: (_parent, { id, displayName }) => ({ id, displayName }),
      delete{{ EntityName }}: () => false,
    },
  },
{% endif %}
});
