# SolMate frontend

Vite + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui (Radix) + Motion + MapLibre GL.

```bash
npm install
npm run dev        # http://localhost:5173/solmate/
npm run lint       # oxlint
npm test           # vitest (science modules)
npm run build      # type-check + production build to dist/ (404.html SPA fallback included)
```

The app is served under `/solmate/` (GitHub Pages). Static data artifacts produced by the analysis pipeline live in `public/data/`.
