import type { Cluster, Redis } from 'ioredis';
import { createClient } from 'redis';
import type {
  IORedisClient,
  RedisClient,
} from '../src/index.js';

describe('Redis client types', () => {
  it('accepts the official node-redis client', () => {
    const assertCompatible = (client: ReturnType<typeof createClient>) => {
      const compatible: RedisClient = client;
      return compatible;
    };
    expect(assertCompatible).toBeTypeOf('function');
  });

  it('accepts ioredis standalone and cluster clients', () => {
    const assertStandaloneCompatible = (client: Redis) => {
      const compatible: IORedisClient = client;
      return compatible;
    };
    const assertClusterCompatible = (client: Cluster) => {
      const compatible: IORedisClient = client;
      return compatible;
    };
    expect(assertStandaloneCompatible).toBeTypeOf('function');
    expect(assertClusterCompatible).toBeTypeOf('function');
  });
});
