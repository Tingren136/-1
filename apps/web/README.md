This is a [Next.js](https://nextjs.org) app inside the monorepo.

## Getting started (pnpm workspace)

- Install dependencies once from the repo root: `pnpm install`.
- Start the web dev server from the root: `pnpm --filter web dev` (or the shortcut script `pnpm dev`).
- Lint or build from the root as well: `pnpm --filter web lint` / `pnpm --filter web build`.

Open http://localhost:3000 to view the app. Edit `apps/web/app/page.tsx` (or other files under `apps/web/src`) to see live updates.

For framework docs, see the [Next.js documentation](https://nextjs.org/docs).
