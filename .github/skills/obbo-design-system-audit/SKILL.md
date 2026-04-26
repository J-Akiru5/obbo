---
name: obbo-design-system-audit
description: "Use when reviewing or refactoring OBBO TSX/CSS for Clean Industrial design-system compliance."
---

# OBBO Design-System Audit

Use this skill for UI review, cleanup, or refactor tasks.

## Audit Checklist
1. Palette compliance:
- Primary actions and key highlights use Industrial tokens from [src/app/globals.css](../../../src/app/globals.css).

2. Auth/landing navigation:
- Standalone auth pages include a visible Back to Home action with `ArrowLeft`.

3. Active states:
- Current nav destination is visually distinct in sidebars/topbars.

4. Dashboard card treatment:
- Card border and radius are subtle and consistent.
- Shadow use remains restrained.

5. Responsive rules:
- Tables include overflow handling on small screens.
- Forms collapse to vertical stack on small screens.

6. Sticky topbars:
- Top toolbars remain sticky when pattern applies.

## Reporting Format
When asked for a review, list findings by severity and file location first, then include any residual risks.

## References
- [.agents/rules/design-system.md](../../../.agents/rules/design-system.md)
- [.github/instructions/clean-industrial.instructions.md](../../../.github/instructions/clean-industrial.instructions.md)
