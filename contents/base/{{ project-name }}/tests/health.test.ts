import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildManagementApp } from '../src/management';
import { schema } from '../src/schema';
import { createYoga } from 'graphql-yoga';
import type { FastifyInstance } from 'fastify';

describe('management health endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildManagementApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/readiness returns 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/readiness' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('GET /health/liveness returns 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/liveness' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('graphql health query', () => {
  const yoga = createYoga({ schema });

  it('health query returns OK', async () => {
    const response = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ health }' }),
    });
    const data = await response.json() as { data: { health: string } };
    expect(data.data.health).toBe('OK');
  });
});
