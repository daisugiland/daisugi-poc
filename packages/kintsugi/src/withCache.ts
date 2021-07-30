import { encToFNV1A } from './encToFNV1A';
import { Code } from './Code';
import { ResultFn, ResultOk, ResultFail } from './types';
import { randomBetween } from './randomBetween';

interface WithCacheOptions {
  version?: string;
  maxAgeMs?: number;
  buildCacheKey?(
    fnHash: number,
    version: string,
    args: any[],
  ): string;
  calculateCacheMaxAgeMs?(maxAgeMs: number): number;
  shouldCache?(response): boolean;
  shouldInvalidateCache?(args: any[]): boolean;
}

const MAX_AGE_MS = 1000 * 60 * 60 * 4; // 4h.
const VERSION = 'v1';

export interface CacheStore {
  get(cacheKey: string): ResultOk<any> | ResultFail<any>;
  set(
    cacheKey: string,
    value: any,
    maxAgeMs: number,
  ): ResultOk<any> | ResultFail<any>;
}

export function buildCacheKey(
  fnHash: number,
  version: string,
  args: any[],
) {
  return `${fnHash}:${version}:${JSON.stringify(args)}`;
}

export function calculateCacheMaxAgeMs(maxAgeMs: number) {
  return randomBetween(maxAgeMs * 0.75, maxAgeMs);
}

export function shouldInvalidateCache(args: any[]) {
  return false;
}

export function shouldCache(response) {
  if (response.isSuccess) {
    return true;
  }

  // Cache NotFound by default.
  // https://docs.fastly.com/en/guides/http-code-codes-cached-by-default
  if (
    response.isFailure &&
    response.error.code === Code.NotFound
  ) {
    return true;
  }

  return false;
}

export function createWithCache(
  cacheStore: CacheStore,
  options: WithCacheOptions = {},
) {
  return function withCache(
    fn: ResultFn,
    _options: WithCacheOptions = {},
  ) {
    const version =
      _options.version || options.version || VERSION;
    const maxAgeMs =
      _options.maxAgeMs || options.maxAgeMs || MAX_AGE_MS;
    const _generateCacheKey =
      _options.buildCacheKey ||
      options.buildCacheKey ||
      buildCacheKey;
    const _generateCacheMaxAge =
      _options.calculateCacheMaxAgeMs ||
      options.calculateCacheMaxAgeMs ||
      calculateCacheMaxAgeMs;
    const _shouldCache =
      _options.shouldCache ||
      options.shouldCache ||
      shouldCache;
    const _shouldInvalidateCache =
      _options.shouldInvalidateCache ||
      options.shouldInvalidateCache ||
      shouldInvalidateCache;
    const fnHash = encToFNV1A(fn.toString());

    return async function (...args) {
      const cacheKey = _generateCacheKey(
        fnHash,
        version,
        args,
      );

      if (!_shouldInvalidateCache(args)) {
        const cacheResponse = await cacheStore.get(
          cacheKey,
        );

        if (cacheResponse.isSuccess) {
          return cacheResponse.value;
        }
      }

      const response = await fn.apply(this, args);

      if (_shouldCache(response)) {
        cacheStore.set(
          cacheKey,
          response,
          _generateCacheMaxAge(maxAgeMs),
        ); // Silent fail.
      }

      return response;
    };
  };
}
