export interface TokenBucketState {
  tokens: number;
  updatedAt: number;
  capacity: number;
  refillPerMs: number;
}

export interface TokenBucketResult {
  state: TokenBucketState;
  allowed: boolean;
  retryAfterMs: number;
}

export function consumeTokenBucket(
  current: TokenBucketState | undefined,
  capacity: number,
  refillPerMs: number,
  now: number,
): TokenBucketResult {
  const state: TokenBucketState = !current || current.capacity !== capacity || current.refillPerMs !== refillPerMs
    ? { tokens: capacity, updatedAt: now, capacity, refillPerMs }
    : { ...current };
  const elapsed = Math.max(0, now - state.updatedAt);
  state.tokens = Math.min(capacity, state.tokens + elapsed * refillPerMs);
  state.updatedAt = now;

  if (state.tokens >= 1) {
    state.tokens -= 1;
    return { state, allowed: true, retryAfterMs: 0 };
  }

  const retryAfterMs = refillPerMs > 0 ? Math.max(1, Math.ceil((1 - state.tokens) / refillPerMs)) : 60_000;
  return { state, allowed: false, retryAfterMs };
}
