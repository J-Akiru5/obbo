---
name: obbo-inp-optimization
description: "Use when optimizing INP, click latency, input responsiveness, main-thread blocking, or component interactions without changing user-facing behavior."
---

# OBBO INP Optimization

Use this skill when an interaction feels sluggish or blocking.

## Inputs to Check First
- [AGENTS.md](../../../AGENTS.md)
- [src/app/admin/layout.tsx](../../../src/app/admin/layout.tsx)
- [src/app/client/layout.tsx](../../../src/app/client/layout.tsx)
- [src/app/page.tsx](../../../src/app/page.tsx)
- [src/components/scroll-reveal.tsx](../../../src/components/scroll-reveal.tsx)
- [src/components/count-up.tsx](../../../src/components/count-up.tsx)
- [src/lib/actions/admin-actions.ts](../../../src/lib/actions/admin-actions.ts)
- [src/lib/actions/client-actions.ts](../../../src/lib/actions/client-actions.ts)
- [src/lib/store/app-store.ts](../../../src/lib/store/app-store.ts)

## Workflow
1. Preserve semantics and control flow; only reduce interaction cost.
2. Keep urgent updates urgent and move non-urgent state changes behind `startTransition` or equivalent when safe.
3. Minimize work inside event handlers; extract expensive computation and DOM churn out of the hot path.
4. Prefer CSS or precomputed state over JS-driven animation for repeated interactions.
5. Avoid synchronous loops, broad state updates, and unnecessary re-renders in client components.
6. Use deferred rendering for expensive filters, tables, or derived views when it does not change results.
7. Check whether a server action, cached fetch, or local state split can move work off the interaction path.
8. Do not alter labels, flows, permissions, or side effects just to improve responsiveness.

## Done Criteria
- Interaction latency is lower or less blocking.
- UI output and side effects remain equivalent.
- The hottest event path is narrower.
- Validation uses targeted interaction testing plus `npm run lint` if code changes are made.