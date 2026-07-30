---
trigger: always_on
glob: '**/*.{tsx,css}'
description: Rules for the OBBO iManage "Clean Industrial" design system and UX patterns.
---

# Design System: Clean Industrial

## 1. Palette & Theming

- **Primary (Deep Blue):** Use `--primary` for main actions, headers, active states, and primary buttons.
- **Accent (Construction Yellow):** Use `--accent` for CTA buttons, alerts, and highlighting important counts/badges.
- **Industrial accents:** `--color-industrial-blue`, `--color-industrial-green`, etc. are decorative accents for KPI card stripes, branded icons, and gradient effects — not for primary UI elements.
- **Neutral (Slate/Gray):** Use the semantic `--secondary`, `--muted`, and `--background` tokens, which use a slate-adjacent scale in both light and dark modes.
- **Typography:** Use Geist (Geist Sans + Geist Mono) with bold tracking-tight headings.

## 2. Navigation Patterns (UX)

- **Back Buttons:** All standalone auth/landing-related pages (Login, Register, Pending) must have a clear "Back to Home" button or link with an `ArrowLeft` icon in the top-left or prominent position.
- **Active States:** Sidebar and Navbar links must clearly indicate the current page using `var(--color-industrial-blue)` or a distinct background.
- **Dashboards:** Use Cards with subtle 1px borders and 8px/12px border-radius. Avoid heavy shadows; use `shadow-sm` or custom low-opacity blue-tinted shadows.

## 3. Responsive Behavior

- **Mobile-First:** Ensure all tables use `overflow-x-auto` and forms stack vertically on smaller screens.
- **Toolbars:** Topbars should stick to the top: `sticky top-0 z-30`.
