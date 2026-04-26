---
applyTo: "**/*.{tsx,css}"
description: "Apply OBBO Clean Industrial design-system rules when editing frontend TSX/CSS."
---

# OBBO Clean Industrial Instruction

Follow the design-system source of truth:
- [.agents/rules/design-system.md](../../.agents/rules/design-system.md)

When editing TSX/CSS, enforce these defaults:
1. Palette and tokens: use CSS variables like `var(--color-industrial-blue)` and `var(--color-industrial-yellow)` from [src/app/globals.css](../../src/app/globals.css).
2. Auth and landing navigation: standalone auth and pending pages must keep a visible "Back to Home" action with `ArrowLeft`.
3. Active navigation states: sidebar/top navigation must clearly mark active routes with Industrial Blue or a distinct active background.
4. Dashboard cards: prefer subtle 1px borders, 8-12px radius, and low-intensity shadows (`shadow-sm` or subtle blue-tinted shadow).
5. Responsive behavior: tables use horizontal overflow wrappers, and forms stack vertically on small screens.
6. Topbars: keep topbars sticky where applicable (`sticky top-0 z-30`).

Project examples:
- [src/app/login/page.tsx](../../src/app/login/page.tsx)
- [src/app/pending/page.tsx](../../src/app/pending/page.tsx)
- [src/app/admin/layout.tsx](../../src/app/admin/layout.tsx)
