---
name: obbo-page-load-optimization
description: "Use when optimizing page load speed, hydration cost, bundle size, render blocking, or preserving component behavior while reducing time to first paint."
---

# OBBO Page Load Optimization

Use this skill when improving load speed without changing visible behavior.

## Inputs to Check First
- [AGENTS.md](../../../AGENTS.md)
- [src/app/layout.tsx](../../../src/app/layout.tsx)
- [src/app/page.tsx](../../../src/app/page.tsx)
- [src/app/admin/layout.tsx](../../../src/app/admin/layout.tsx)
- [src/components/scroll-reveal.tsx](../../../src/components/scroll-reveal.tsx)
- [src/components/count-up.tsx](../../../src/components/count-up.tsx)
- [src/lib/supabase/server.ts](../../../src/lib/supabase/server.ts)
- [src/lib/supabase/client.ts](../../../src/lib/supabase/client.ts)

## Workflow
1. Preserve behavior first; optimize implementation, not product decisions.
2. Prefer server components and route-level data loading over client hydration when the UI does not need client state.
3. Keep client islands small; move non-interactive content out of `"use client"` files when possible.
4. Defer non-critical visuals and animation-heavy sections until after above-the-fold content is ready.
5. Prefer `next/image`, `next/font`, and static assets already in `public/` over new runtime work.
6. Split large pages into route-local components only when it reduces the client bundle or hydration cost.
7. Avoid adding new dependencies or memoization unless the slowed path justifies it.
8. Keep skeletons, placeholders, and lazy loading behavior visually equivalent to the original UI.

## Done Criteria
- Visible behavior stays the same.
- Initial load work is smaller or deferred.
- Client-side JavaScript is reduced where possible.
- Validation uses `npm run lint` and `npm run build` when the change could affect production rendering.