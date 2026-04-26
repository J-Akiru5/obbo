---
name: obbo-clean-industrial-ui
description: "Use when building or updating OBBO frontend UI in TSX/CSS, including auth pages, dashboards, and navigation components."
---

# OBBO Clean Industrial UI

Use this skill for implementation work where UI must follow the OBBO visual system.

## Inputs to Check First
- [.agents/rules/design-system.md](../../../.agents/rules/design-system.md)
- [src/app/globals.css](../../../src/app/globals.css)
- Existing UI patterns in:
  - [src/app/login/page.tsx](../../../src/app/login/page.tsx)
  - [src/app/pending/page.tsx](../../../src/app/pending/page.tsx)
  - [src/app/admin/layout.tsx](../../../src/app/admin/layout.tsx)

## Implementation Workflow
1. Reuse existing design tokens before adding new colors.
2. Keep auth/landing pages with a clear `ArrowLeft` + Back to Home action.
3. Preserve explicit active route states in nav elements.
4. Keep dashboards clean: thin borders, moderate radius, restrained shadows.
5. Make responsive behavior explicit for tables and forms.
6. Validate visual consistency in both desktop and mobile widths.

## Done Criteria
- Uses Industrial Blue and Yellow tokens from global theme.
- Does not regress active-state clarity.
- Does not remove required auth back navigation patterns.
- Keeps sticky topbar behavior in dashboard-like layouts.
- Keeps forms and data tables usable on narrow screens.
