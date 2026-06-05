import { createSchema } from 'graphql-yoga';
{% if persistence ~= 'None' %}import type { getDb } from './resources/persistence';
{% endif %}{% if cache ~= 'None' %}import type { getCache } from './resources/cache';
{% endif %}{% if messaging ~= 'None' %}import type { getProducer } from './resources/messaging';
{% endif %}
export type AppContext = {
{% if persistence ~= 'None' %}  db?: ReturnType<typeof getDb>;
{% endif %}{% if cache ~= 'None' %}  cache?: ReturnType<typeof getCache>;
{% endif %}{% if messaging ~= 'None' %}  producer?: ReturnType<typeof getProducer>;
{% endif %}};

export const schema = createSchema<AppContext>({
  typeDefs: `
    type {{ PrefixName }}{{ SuffixName }} {
      id: ID!
      displayName: String!
    }

    type Query {
      health: String!
      get{{ PrefixName }}{{ SuffixName }}(id: ID!): {{ PrefixName }}{{ SuffixName }}
      list{{ PrefixName }}{{ SuffixName }}s: [{{ PrefixName }}{{ SuffixName }}!]!
    }

    type Mutation {
      create{{ PrefixName }}{{ SuffixName }}(displayName: String!): {{ PrefixName }}{{ SuffixName }}!
      update{{ PrefixName }}{{ SuffixName }}(id: ID!, displayName: String!): {{ PrefixName }}{{ SuffixName }}!
    }
  `,
  resolvers: {
    Query: {
      health: () => 'OK',
      get{{ PrefixName }}{{ SuffixName }}: (_parent, { id }) => ({ id, displayName: '' }),
      list{{ PrefixName }}{{ SuffixName }}s: () => [],
    },
    Mutation: {
      create{{ PrefixName }}{{ SuffixName }}: (_parent, { displayName }) => ({ id: crypto.randomUUID(), displayName }),
      update{{ PrefixName }}{{ SuffixName }}: (_parent, { id, displayName }) => ({ id, displayName }),
    },
  },
});
