<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Agent Notes

- Primary stack: Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui.
- Common commands:
	- `npm run dev`
	- `npm run build`
	- `npm run lint`

## UI Convention Sources

- Clean Industrial design rules: [.agents/rules/design-system.md](.agents/rules/design-system.md)
- Auto-applied frontend instruction: [.github/instructions/clean-industrial.instructions.md](.github/instructions/clean-industrial.instructions.md)
- Implementation skill: [.github/skills/obbo-clean-industrial-ui/SKILL.md](.github/skills/obbo-clean-industrial-ui/SKILL.md)
- Review and audit skill: [.github/skills/obbo-design-system-audit/SKILL.md](.github/skills/obbo-design-system-audit/SKILL.md)

## Performance Optimization Skills

- Page-load optimization: [.github/skills/obbo-page-load-optimization/SKILL.md](.github/skills/obbo-page-load-optimization/SKILL.md)
- INP optimization: [.github/skills/obbo-inp-optimization/SKILL.md](.github/skills/obbo-inp-optimization/SKILL.md)
- Use these for tasks that improve loading speed or interaction latency without changing component behavior.

Use links above as source of truth for TSX/CSS edits before introducing new visual patterns.
