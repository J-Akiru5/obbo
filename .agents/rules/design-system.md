---
trigger: always_on
glob: "**/*.{tsx,css}"
description: Rules for the OBBO iManage "Clean Industrial" design system and UX patterns.
---

# Design System: Clean Industrial

## 1. Palette & Theming
* **Primary (Deep Blue):** Use `var(--color-industrial-blue)` for main actions, headers, and active states.
* **Accent (Construction Yellow):** Use `var(--color-industrial-yellow)` for CTA buttons, alerts, and highlighting important counts/badges.
* **Neutral (Slate/Gray):** Use Slate-900 for sidebar text and Slate-50/100 for page backgrounds.
* **Typography:** Use sans-serif (Inter preferred) with bold tracking-tight headings.

## 2. Navigation Patterns (UX)
* **Back Buttons:** All standalone auth/landing-related pages (Login, Register, Pending) must have a clear "Back to Home" button or link with an `ArrowLeft` icon in the top-left or prominent position.
* **Active States:** Sidebar and Navbar links must clearly indicate the current page using `var(--color-industrial-blue)` or a distinct background.
* **Dashboards:** Use Cards with subtle 1px borders and 8px/12px border-radius. Avoid heavy shadows; use `shadow-sm` or custom low-opacity blue-tinted shadows.

## 3. Responsive Behavior
* **Mobile-First:** Ensure all tables use `overflow-x-auto` and forms stack vertically on smaller screens.
* **Toolbars:** Topbars should stick to the top: `sticky top-0 z-30`.
