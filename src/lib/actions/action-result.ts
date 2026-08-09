// Next.js redacts every uncaught `throw` inside a Server Action in production
// builds — the client never receives the real error.message, only a generic
// digest. This is documented, intentional Next.js behavior (see
// node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md):
// "For [expected] errors, avoid using try/catch blocks and throw errors.
// Instead, model expected errors as return values."
//
// safeAction wraps an existing action WITHOUT touching its internals — every
// `throw new Error('message')` inside stays exactly as-is. The wrapper
// catches it and returns a normal object instead. A normal return value is
// never redacted, because nothing crossed the action boundary as an
// exception.
//
// Usage (only the export line changes, function body is untouched):
//   async function _submitOrder(...) { ...unchanged, still throws... }
//   export const submitOrder = safeAction(_submitOrder);
//
// Call sites change from try/catch to a result check:
//   const result = await submitOrder(orderData);
//   if (!result.success) { toast.error(result.error); return; }
//   // use result.data

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export function safeAction<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
): (...args: Args) => Promise<ActionResult<T>> {
  return async (...args: Args): Promise<ActionResult<T>> => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred.',
      };
    }
  };
}
