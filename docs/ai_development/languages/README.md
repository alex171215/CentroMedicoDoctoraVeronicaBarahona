# Language Guidelines Index

This folder contains language-specific development guidance for contributors and AI agents.

The goal is to provide a lightweight entry point so agents can quickly discover what language standards are available, then load only the relevant language docs during implementation.

## Available Languages

- **JavaScript (Vanilla)**: Conventions and standards for pure ES6+ JavaScript development, focusing on modularity, asynchronous operations, and DOM manipulation.
- **CSS / HTML**: Standards for semantic markup, mobile-first responsive design, and CSS variables/flexbox/grid.

## Agent Usage Notes

1. Read this file first to discover available language packs.
2. Load only the language folder needed for the current task.
3. Prefer concise, deterministic conventions when generating or modifying code.
4. If no language guidance exists for a requested stack, ask for direction before inventing standards.

## Expansion Model

When adding a new language, create a dedicated subfolder and include:

- A general language conventions guide
- Framework-focused guide(s) as needed
- Optional summary docs for quick consumption

Keep guidance practical, implementation-oriented, and easy for both humans and agents to apply.
