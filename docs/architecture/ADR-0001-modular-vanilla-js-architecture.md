# ADR-0001: Modular Vanilla JavaScript Architecture

## Status
Accepted

## Context
The project requires a strict separation of concerns (HTML for structure, CSS for presentation, JS for logic) without the use of external frameworks or libraries. We need scalable modularity to simulate a real-world frontend environment while keeping operations lightweight.

## Decision
Adopt an MVC-inspired modular architecture using ES6+ modules (`app.js`, `view.js`, `repo.js`, `cart.js`).

## Consequences
- Predictable execution order.
- Clear separation between DOM manipulation, business logic, and data fetching.
- Enables deterministic AI-assisted development and easier unit testing (if needed in the future).
- Strictly client-side, zero backend dependencies.
