---
name: optimize-page-performance
description: "Use when asked to improve page load speed or INP for a specific route or component without changing visible behavior."
---

# Optimize Page Performance

You are working in the OBBO iManage repo.

## Goal
Improve performance for the target page or component while keeping user-facing behavior, labels, permissions, and layout intent unchanged.

## Inputs
- Target route or component: {{target}}
- Primary goal: {{goal}}

## Workflow
1. If the goal is load speed, load [OBBO Page Load Optimization](../skills/obbo-page-load-optimization/SKILL.md) and use it as the primary workflow.
2. If the goal is interaction latency or input responsiveness, load [OBBO INP Optimization](../skills/obbo-inp-optimization/SKILL.md) and use it as the primary workflow.
3. Inspect the target route and nearby server/client boundaries before changing code.
4. Prefer the smallest change that reduces the bottleneck.
5. Preserve visible behavior, copy, permissions, and side effects.
6. Validate the touched slice with the narrowest relevant check, then use `npm run lint` or `npm run build` when the change affects production rendering or interaction code.

## Output
Return:
- The likely bottleneck you found.
- The minimal change you would make.
- The validation you would run next.