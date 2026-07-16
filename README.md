# Nameslav Roulette

*whoami, but it tells you which (.\*)slav you are today*

A joke pet project for `name.svyatbeloz.link`. The author's colleagues keep mangling his name "Святослав" into compound nicknames — Куберслав, Девопсослав, Домослав and so on. This turns that running joke into a tiny site: every visitor gets a personal "Svyatoslav of the day", computed deterministically from the date and a few harmless browser signals — no accounts, no server-side storage of anything about the visitor.

## How it works

- The homepage computes your personal name **entirely in the browser** (date + a hash of a few `navigator`/`screen` values) — nothing is sent to the server, checkable in the Network tab.
- The daily "name of the day" (shown when the bare domain is shared) is computed server-side from the date alone, same for everyone.
- Results are shareable via `/r/:token` links that carry the result itself (not a seed), so they resolve to the same name for anyone who opens them, including OG-preview crawlers.

See `docs/00-overview.md` onward for the full design — data formats, the selection algorithm, share-link format, i18n, deployment. This README only covers running the code.

## Stack

Node.js + TypeScript + Express, OG images rendered via [Takumi](https://takumi.kane.tw/) (JSX → PNG, no headless browser), name bank and UI strings in YAML validated with Zod at startup, vanilla JS/HTML/CSS frontend with no build step.

## Requirements

- Node.js ≥ 20
- npm

## Getting started

```bash
npm install
cp .env.example .env   # edit SITE_DOMAIN for local use, e.g. localhost:3000
npm run dev
```

The server starts on `http://localhost:3000` (configurable via `PORT`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the server with `tsx watch` (auto-restarts on change) |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm start` | Runs the compiled server from `dist/server.js` |
| `npm run typecheck` | Type-checks without emitting |
| `npm test` | Runs the unit tests (`node:test`, no extra dependencies) |

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SITE_DOMAIN` | yes | — | Domain used in OG images, meta tags, and `/api/config.json` |
| `PORT` | no | `3000` | Port Express listens on |
| `NODE_ENV` | no | `production` | Standard Node env flag |
| `FINGERPRINT_SALT` | no | built-in default | Non-secret salt mixed into the client-side fingerprint hash |
| `FINGERPRINT_FIELDS` | no | all known signals | Comma-separated subset/order of browser signals to hash |

The UI locale (`src/i18n/locale.yaml`) and the name bank (`src/names/bank/*.yaml`) are edited directly, not via environment variables — see `docs/04-i18n.md` and `docs/01-name-bank.md`.

## Project layout

```
src/
├── server.ts          # entry point: config → bank → locale → fonts → routes → listen
├── config/            # env vars, fingerprint field validation
├── names/             # name bank loading/validation, selection algorithm
├── i18n/              # UI locale loading and date/placeholder formatting
├── og/                # Takumi-based OG image rendering + daily disk cache
└── routes/            # Express routes (health, og-image, share, api/*)

public/                # static frontend — no bundler, served as-is
  assets/
    script.js          # orchestration: fetch config/bank/locale, compute the name, render
    fingerprint.js      # browser signal collectors
    selectorMath.js      # mirror of src/names/selector.ts, using Web Crypto
    fonts/                # bundled Noto Sans (Cyrillic-covering) for OG images
```

## Docker

```bash
mkdir -p cache && chown 1000:1000 cache   # once, before the first run
docker compose up --build
```

The container runs as a fixed non-root user (`1000:1000`), so the bind-mounted `cache/` directory needs to be writable by that UID beforehand — otherwise `/readyz` starts returning 503. The container also runs with a read-only root filesystem, `cap_drop: ALL`, and no new privileges — see `docs/08-deployment.md` for the full rationale.

Health checks: `GET /livez` (process is alive) and `GET /readyz` (bank/locale loaded, cache directory writable) — the compose healthcheck uses the latter.

## Name bank

`src/names/bank/` currently ships a minimal starter set (two regular categories plus the `not_found` fallback category). Add more `*.yaml` files following the format in `docs/01-name-bank.md` — the server validates the whole bank at startup and refuses to start on structural problems (duplicate ids/names/slugs, bad references, etc).

Under Docker, both the name bank and `src/i18n/locale.yaml` are bind-mounted read-only into the container, so editing them on the host only needs a `docker compose restart`, not a rebuild.

## License

MIT — see `LICENSE`.
