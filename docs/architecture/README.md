# Architecture Overview

## Purpose
This document is the fast orientation guide for engineers and AI agents working in this repository. It explains the system boundaries, the layered architecture, and the operational rules required to modify the code safely under the project's strict vanilla constraints.

It is intentionally practical: where components live, how data flows, how to run/test locally, and which failure modes are most common.

## System Context

```text
       [Web Browser]
             |
             v
[Vanilla JS (ES6+) Modules]
             |
             v
[Client-Side Web Storage APIs]
(localStorage, sessionStorage, IndexedDB, Cookies)
```

External APIs: NONE
Frameworks (React, Vue, etc.): NONE
CSS Libraries (Tailwind, Bootstrap, etc.): NONE
Backend Dependencies: NONE

The system is fully self-contained and offline-capable by design.

---

## Core Design Decisions

### Decision 1: Pure Vanilla Frontend with Strict Separation of Concerns
Context: The project aims to demonstrate mastery of core web fundamentals.
Decision: No frameworks or libraries. HTML handles structure, CSS handles presentation, JS handles behavior.
Rationale: Forces deep understanding of the DOM, CSS Grid/Flexbox, and ES6+ features without abstractions.
Consequences: Development is more verbose, but results in a deeper understanding of web APIs.

### Decision 2: MVC-Inspired JavaScript Modularity
Context: A single JavaScript file will become unmaintainable as application logic scales.
Decision: Separate JS logic into discrete ES6 modules by responsibility (`app.js`, `view.js`, `cart.js`, `repo.js`).
Rationale: Enables cleaner code reviews, prevents spaghetti code, and simulates enterprise frontend architecture.
Consequences: Requires use of ES6 `import`/`export` and running via a local server (like VS Code Live Server) to bypass CORS issues with local modules.

### Decision 3: Multi-Tier Client-Side Persistence
Context: The cart state needs to survive page reloads without a backend database.
Decision: Utilize 4 local web storage mechanisms: `localStorage`, `sessionStorage`, `IndexedDB`, and `Cookies`.
Rationale: Proves capability to manage client-side state efficiently.
Consequences: Data must be properly serialized and deserialized via JSON.

---

## Directory Structure

```text
CarritodeComprasDP/
├── assets/                      # Presentation layer (CSS files, images)
│   ├── css/
│   │   └── style.css            # Responsive, mobile-first styling
├── data/                        # Static data repository
│   └── productos.json           # Product catalog data
├── docs/                        # Architecture and requirement documentation
├── js/                          # Behavior and Logic Layer (ES6 Modules)
│   ├── app.js                   # Application entry point and orchestrator
│   ├── view.js                  # DOM manipulation and template rendering
│   ├── cart.js                  # Shopping cart business logic
│   └── repo.js                  # Data fetching and parsing
├── index.html                   # Main semantic entry point
└── README.md                    # Project documentation
```

---

## Data Flow

```text
User Interaction (Click 'Add to Cart')
    |
    v
View Layer (view.js captures event)
    |
    v
App Orchestrator (app.js routes action)
    |
    v
Business Logic (cart.js updates state)
    |
    v
Persistence (cart.js saves to Web Storage)
    |
    v
View Layer (view.js renders updated HTML)
```

---

## Key Patterns

### Pattern 1: Event Delegation
Used for: Efficiently handling clicks on dynamically rendered UI elements (like product cards).
Location: `js/app.js` or `js/view.js`
Implementation: Attach a single event listener to a parent container (`<main>` or `#product-list`) and use `event.target.closest()` to identify the clicked element.

### Pattern 2: Template Literals for Rendering
Used for: Generating HTML strings dynamically without manual DOM creation functions.
Location: `js/view.js`
Implementation: Map over product arrays and return string literals containing semantic HTML, then assign to `innerHTML`.

### Pattern 3: Asynchronous Data Fetching
Used for: Loading the static product catalog.
Location: `js/repo.js`
Implementation: Use the `fetch` API wrapped in `async/await` to retrieve and parse `productos.json`.

---

## Development Environment

Prerequisites:
- A modern Web Browser (Chrome, Firefox, Safari, Edge).
- A local web server (e.g., VS Code "Live Server" extension, Python's `http.server`, or Node's `http-server`).

Primary setup:
1. Clone the repository.
2. Open the project in your IDE.
3. Start a local server (necessary to support ES6 module imports).
4. Navigate to `http://localhost:<port>` to view `index.html`.

---

## Common Pitfalls

### Pitfall 1: Mixing DOM Manipulation and Business Logic
Problem: Modifying cart arrays directly inside event listeners alongside updating HTML.
Solution: Keep state manipulation in `cart.js` and DOM rendering in `view.js`. Use `app.js` to coordinate.

### Pitfall 2: Forgetting to stringify data for Web Storage
Problem: Trying to save complex arrays/objects directly into `localStorage`, resulting in `[object Object]`.
Solution: Always use `JSON.stringify()` when saving and `JSON.parse()` when retrieving data.

### Pitfall 3: Not using a Local Server
Problem: Opening `index.html` directly from the filesystem (`file:///...`) throws CORS errors when using ES6 modules.
Solution: Always serve the project via a local HTTP server during development.

### Pitfall 4: Missing ARIA and Focus States
Problem: Removing focus outlines for aesthetics or failing to announce dynamic changes to screen readers.
Solution: Adhere strictly to POUR principles. Provide custom focus states if defaults are hidden, and use `aria-live` or similar for dynamic updates.

---

## Further Reading

- `../technical-requirements.md`
- `../../golden-rules.md`
- `../product-requirements.md`
