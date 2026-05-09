# Repository Guidelines

## Project Structure & Module Organization

This is a static Vite + React + TailwindCSS application. Source code lives in `src/`, with the main UI in `src/main.jsx`, shared speed-test logic in `src/lib/speedTest.js`, and global styles in `src/styles.css`. Static entry files and build configuration stay at the root: `index.html`, `vite.config.js`, `tailwind.config.js`, and `postcss.config.js`. Production builds output to `dist/`.

## Build, Test, and Development Commands

- `npm install`: install project dependencies.
- `npm run dev`: start the Vite development server.
- `npm run build`: create the static production build in `dist/`.
- `npm run preview`: preview the production build locally.
- `npm run lint`: run ESLint checks.

This project has no backend, database, or always-running server. Keep new commands reproducible from a fresh checkout.

## Coding Style & Naming Conventions

Use React function components, hooks, and plain JavaScript modules. Keep UI components in `PascalCase`, helper functions in `camelCase`, and constants in `SCREAMING_SNAKE_CASE` when they represent fixed configuration. Prefer small, focused functions in `src/lib/` for calculations and browser measurement code. Use Tailwind utility classes for layout and styling; keep custom CSS in `src/styles.css` for global behavior only.

## Testing Guidelines

No automated test framework is configured yet. When adding tests, place them under `tests/` or beside modules as `*.test.js`, and cover conversion math, estimator output, stability scoring, and quality labels. Browser speed tests depend on network conditions, so prefer unit tests for calculations and manual verification for live transfer behavior.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries, such as `add docs`. Continue with concise messages like `add speed gauge` or `fix upload averaging`.

Pull requests should include a behavior summary, validation commands run, linked issues when applicable, and screenshots for UI changes. Keep infrastructure simple and static-host friendly.

## Agent-Specific Instructions

Do not add a traditional backend, Express server, database, VPS dependency, or paid infrastructure. Preserve the core conversion `Usable MB/s = Mbps / 8`, and always show Mbps alongside MB/s.
