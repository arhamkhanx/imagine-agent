# kive — AI fashion content studio

An agentic content-creation tool for fashion brands. Create reusable **models (faces)**, **products**, and **moodboards**, then describe a shot in plain English (`@maya wearing @camel_trench in the style of @soft_minimal`). An agent analyzes your references and the moodboard's aesthetic, writes an optimal, real-camera photography prompt, and renders premium imagery — all powered by xAI's Grok models.

Everything runs **locally**: a single SQLite database and images saved to the `public/` folder. No external services beyond the xAI API.

---

## Highlights

- **Faces** — Upload real model photos or generate net-new AI models from a description. Generate additional **angles** (front, ¾, profile…) from one image, all preserving identity.
- **Products** — Same flow for garments/accessories, with product angles (front, back, side, detail, flat-lay…).
- **Moodboards** — A drag-and-drop canvas. It **auto-saves**, and silently converts the board into a detailed text "aesthetic brief" used to steer generations (the brief is never shown — you just drop images).
- **Studio (agentic generation)** — Reference your library with `@handle` (rendered as inline chips with thumbnails). An agent reads your model + product + moodboard, writes the prompt, and renders **1–4 variants** at max quality, bundled into one result card.
- **Refine anything** — Click any image (results, angles, uploads) to open a chat pane. Comment + optionally attach reference samples; the agent analyzes intent and writes a surgical edit. **Your raw text is never sent to the image model** — the agent is always in the middle.
- **Photorealism mandate** — Every prompt is engineered to look like a genuine photograph shot on a real camera (named camera/lens/aperture, lighting design, film stock/grade, authentic skin & fabric texture), never artificial/AI-looking.
- **Brands/workspaces** — Organize everything per brand and switch between them.

---

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local database
- [sharp](https://sharp.pixelplumbing.com/) — image transcoding (normalizes uploads to model-safe JPEG)
- xAI Grok API:
  - `grok-4.3-latest` — the agent (reasoning, vision, structured prompt writing)
  - `grok-imagine-image-quality-latest` — image generation & editing (rendered at 2K)

---

## Prerequisites

- **Node.js 20+** (developed on Node 25)
- **npm**
- An **xAI API key** — create one at <https://console.x.ai/>
- A C/C++ toolchain for native modules (`better-sqlite3`, `sharp`). These ship prebuilt binaries for most platforms, so usually nothing is required. On macOS, having Xcode Command Line Tools (`xcode-select --install`) is enough if a build is needed.

---

## Getting started

```bash
# 1. Clone
git clone https://github.com/arhamkhanx/imagine-agent.git
cd imagine-agent

# 2. Install dependencies
npm install

# 3. Add your xAI API key
cp .env.local.example .env.local
#   then edit .env.local and set XAI_API_KEY=...

# 4. Run the dev server
npm run dev
```

Open <http://localhost:3000>. (If port 3000 is busy, Next will pick the next free port, e.g. 3001 — watch the terminal output.)

The SQLite database (`data/kive.db`) and the `public/uploads/` folder are created automatically on first run, and a default brand is seeded.

### Environment variables

| Variable      | Required | Description                                  |
| ------------- | -------- | -------------------------------------------- |
| `XAI_API_KEY` | Yes      | Your xAI API key. Read at runtime, never committed. |

---

## How it works

1. **Build your library** — Add faces and products (upload or AI-generate). Label uploaded angles with single words (or pick presets). Each item gets a unique, editable `@handle` (lowercase/underscore/numbers). Max 5 images per item — the agent curates the best references.
2. **Set the aesthetic** — Create a moodboard and drop reference images on the canvas. It auto-saves and builds a hidden aesthetic brief.
3. **Generate** — In Studio, write an instruction using `@handles`, pick an aspect ratio and 1–4 variants. The agent:
   - resolves your mentions and studies every reference image (vision),
   - reads the moodboard brief,
   - writes a dense, real-camera prompt,
   - renders via image-edit (when references exist) or text-to-image, at 2K.
4. **Refine** — Click any image, chat your change, optionally attach samples. The agent writes the edit and re-renders. Save refined results back to a face/product if you like.

---

## Project structure

```
src/
  app/
    page.tsx              # Studio (agentic generation)
    faces/ products/      # Library pages (use SubjectManager)
    moodboards/           # Moodboard list + canvas editor
    api/                  # Route handlers (brands, faces, products, moodboards, generate, refine)
  components/
    Shell, BrandContext   # App shell + brand switcher
    SubjectManager        # Faces/Products UI (create + detail modals, angles, image mgmt)
    MentionInput          # @mention chip input with thumbnails
    RefinePanel           # Chat-style refine pane
    Modal
  lib/
    db.ts                 # SQLite schema + connection
    repo.ts               # Typed data access
    xai.ts                # xAI API client (image gen/edit, chat, structured output)
    agent.ts              # The agent: prompt planning, moodboard briefs, refinement, photorealism mandate
    storage.ts            # Save images + transcode to model-safe JPEG (sharp)
    slug.ts, limits.ts, client.ts
data/                     # SQLite DB (gitignored)
public/uploads/           # Generated & uploaded images (gitignored)
```

---

## Scripts

| Command         | Description                       |
| --------------- | --------------------------------- |
| `npm run dev`   | Start the dev server              |
| `npm run build` | Production build                  |
| `npm run start` | Run the production build          |
| `npm run lint`  | Lint                              |

---

## Notes

- **Local data is not committed.** `.env.local`, `data/` (the SQLite DB), and uploaded/generated images under `public/uploads/` are gitignored. To reset everything, delete the `data/` folder and the contents of `public/uploads/`.
- **Cost:** image generation and the agent both call the xAI API, which is billed per use. Generating multiple variants or angles multiplies image calls.
- This is a local single-user tool — there is no authentication. Don't expose it publicly with your API key attached.
