<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# imagine-agent — agent & contributor guide

An agentic AI fashion content studio. Brands create reusable **faces** (models), **products**, and **moodboards**, then describe a shot in plain English referencing them with `@handle`. An agent analyzes the references + moodboard aesthetic, writes an optimal real-camera photography prompt, and renders premium imagery via xAI Grok. Local-only: SQLite + images in `public/`.

## Tech stack
- **Next.js 16** (App Router, route handlers) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (single `src/app/globals.css`, CSS-variable theme)
- **better-sqlite3** — local DB at `data/imagine-agent.db` (gitignored)
- **sharp** — transcodes every model-bound image to JPEG
- **xAI Grok API** (no other external services)

Native deps (`better-sqlite3`, `sharp`) are listed in `next.config.ts` `serverExternalPackages`.

## Project structure
```
src/
  app/
    page.tsx              # Studio (agentic generation)
    faces/ products/      # Library pages (thin wrappers over SubjectManager)
    moodboards/           # List + canvas editor ([id]/page.tsx)
    api/                  # Route handlers (see below)
  components/
    Shell, BrandContext   # App shell (responsive drawer) + brand state
    SubjectManager        # Faces/Products: create + detail modals, angles, image mgmt
    MentionInput          # @mention chip input (contenteditable, thumbnails)
    RefinePanel           # Agent refine chat + version-history strip + fork
    Modal
  lib/
    db.ts                 # SQLite schema, connection, idempotent migrations
    repo.ts               # ALL typed DB access goes here
    xai.ts                # xAI client (image gen/edit, chat, structured output)
    agent.ts              # Prompt planning, moodboard briefs, refinement, PHOTOREALISM
    storage.ts            # Save images + transcode to model-safe JPEG (sharp)
    slug.ts limits.ts client.ts
data/                     # SQLite DB (gitignored)
public/uploads/           # All images, generated + uploaded (gitignored)
```

## Models (always latest)
Defined in `src/lib/xai.ts`. Verified against the live models API; use the `-latest` aliases.
- **Text / agent / vision / structured output** → `grok-4.3-latest`
- **Image generation & editing** → `grok-imagine-image-quality-latest` (render at `resolution: "2k"`, user-controlled `aspect_ratio`)
- Base URL `https://api.x.ai/v1`; key read from `XAI_API_KEY` env (never hardcode/commit).
- When touching xAI code, follow the `xai-models` skill and mirror exact param names.

## Core patterns (baked in — keep these)
1. **Agent-in-the-middle (never raw to the image model).** A user's typed message is never sent to the image model. `agent.ts` (`planGeneration` / `planRefinement`, grok-4.3 + vision) studies the image(s) + intent + attached samples and writes the actual image prompt. Only that prompt + reference images go to `editImage`/`generateImage`.
2. **Photorealism mandate.** `PHOTOREALISM` (exported from `agent.ts`) is appended to every image instruction: named camera/lens/aperture, lighting design, film stock/grade, authentic skin & fabric texture, positive framing, never "AI-looking". Reuse it for any new image-producing path.
3. **Transcode everything bound for a model to JPEG.** xAI image/vision models reject GIF/AVIF/HEIC/SVG. Use `urlToModelDataUri()` (from a stored path) or `dataUriToModelDataUri()` (from a browser data URI) in `storage.ts` before sending images to any model. Originals stay on disk untouched.
4. **Handles.** Lowercase / underscore / numbers, unique per brand. Use `toHandle()` + `uniqueHandle()` in `slug.ts`. Sanitize user-provided labels server-side too.
5. **Image limit.** `MAX_SUBJECT_IMAGES = 5` per face/product (`limits.ts`). Enforce on angle generation, uploads, attach, and fork.
6. **Asset version history ("image journey").** Every image asset has versions in the `image_versions` table (`asset_type` ∈ `face_image | product_image | moodboard_item | generation`). On create, `repo` seeds an "original" version. Refining appends a version via `addVersion()` and replaces the displayed image via `setAssetUrl()` — **latest replaces, old stays in history**. `/api/assets/fork` turns any version into a new independent asset. `db.ts` idempotently seeds versions for pre-existing rows on startup.
7. **Variants share a `batch_id`** (set in `/api/generate`); the Studio groups a batch into one card (`groupByBatch`). Refines/forks get their own batch_id.
8. **Moodboards auto-save; the brief is hidden.** The editor debounce-saves positions (`regenerate:false`) and, on content change, regenerates a detailed text aesthetic brief from the images (vision) — never shown to the user, never blocks the save (`warning` on failure).
9. **All DB access through `repo.ts`.** Route handlers stay thin. Next 16 dynamic route params are a `Promise` — `const { id } = await ctx.params`.
10. **DB connection** is cached on `globalThis` (`db.ts`); migrations are `CREATE ... IF NOT EXISTS` + idempotent seeds so they're safe to re-run.

## UI conventions (Pool-inspired theme)
- Theme via CSS variables in `globals.css`: deep teal canvas (`--bg #001F22`), warm cream text (`--text`), mint accent (`--accent`), sand/sage. Prefer `var(--token)` over hardcoded colors; dark-on-accent text is `--on-accent`.
- Shared classes: `.card` (rounded 24px teal surface), `.btn` (pill, uppercase mono label), `.btn-ghost`, `.btn-danger`, `.tag`, `.label` (mono uppercase).
- **Fully responsive**: `Shell` is a desktop sidebar (`lg:`) and a mobile top-bar + drawer. Use `p-4 md:p-8` page padding, grids that collapse on mobile, and modals/panels that stack on small screens.
- Every image is clickable to **refine** via `RefinePanel`; every entity has full **CRUD**.

## Build & run
```bash
npm install
cp .env.local.example .env.local   # set XAI_API_KEY
npm run dev      # http://localhost:3000 (falls back to 3001 if busy)
npm run build    # always run before committing
```

## Guardrails
- Never commit secrets: `.env.local`, `data/`, and `public/uploads/*` are gitignored (only `.gitkeep` + `.env.local.example` are tracked). Scan staged diffs for `xai-...` keys before committing.
- Run `npm run build` and, when the dev server is up, smoke-test changed flows before reporting done.
