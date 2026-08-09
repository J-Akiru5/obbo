import { describe, it, expect } from 'vitest';
import { safeAction } from './action-result';

describe('safeAction', () => {
  it('returns { success: true, data } when the wrapped function resolves', async () => {
    const wrapped = safeAction(async (x: number) => x * 2);
    const result = await wrapped(21);
    expect(result).toEqual({ success: true, data: 42 });
  });

  it('converts a thrown Error into { success: false, error: message } instead of rejecting', async () => {
    const wrapped = safeAction(async () => {
      throw new Error('Driver name is required for pick-up orders.');
    });
    const result = await wrapped();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Driver name is required for pick-up orders.');
    }
  });

  it('never rejects, even when the wrapped function throws — this is the entire point', async () => {
    const wrapped = safeAction(async () => {
      throw new Error('boom');
    });
    // If this ever rejects, it would cross the Server Action boundary as an
    // uncaught exception and get redacted by Next.js in production.
    await expect(wrapped()).resolves.not.toThrow();
    const result = await wrapped();
    expect(result.success).toBe(false);
  });

  it('falls back to a generic message for a non-Error throw', async () => {
    const wrapped = safeAction(async () => {
      throw 'a raw string, not an Error instance';
    });
    const result = await wrapped();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('An unexpected error occurred.');
    }
  });

  it('passes through multiple arguments correctly', async () => {
    const wrapped = safeAction(async (a: string, b: number, c: boolean) => ({ a, b, c }));
    const result = await wrapped('x', 1, true);
    expect(result).toEqual({ success: true, data: { a: 'x', b: 1, c: true } });
  });
});
