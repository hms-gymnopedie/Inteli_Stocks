# InteliStock — landing page

Single-page marketing site for InteliStock. Vite + React + TypeScript. Independent of `app/` and `server/`.

## Local dev

```bash
cd landing
npm install
npm run dev    # http://localhost:5181
```

## Build

```bash
npm run build  # outputs to landing/dist
npm run preview
```

## Deploy to Vercel (free tier)

From this directory:

```bash
cd landing && vercel
```

First run links the project (accept defaults — `vercel.json` already sets framework, build command, and output dir). After that:

```bash
vercel --prod
```

## Adding the demo recordings

Drop these six files into `public/demos/`:

```
geo-drawer.webm          geo-drawer.png
ai-hedge.webm            ai-hedge.png
copy-to-portfolio.webm   copy-to-portfolio.png
```

No code change required — the page already references them. See the collapsed "How to record the demo GIFs" section at the bottom of the live page for capture settings.

## Constraints

- Matte black `#0a0a0b` background, single orange accent `#e8702a` — do not introduce a second hue.
- No emojis.
- No external UI library — pure CSS in `src/styles.css`.
