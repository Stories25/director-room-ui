# Director's Room — Project Context

> Runway ML Hackathon | May 2026  
> Frontend built with Next.js 16 + Runway Characters API + OpenAI

---

## What This Is

**Director's Room** is the front end for a next-generation AI filmmaking platform. The core experience is a one-session, voice-driven conversation between a director and an AI-powered screenwriter character (Hank Moody), where the director pitches a 30-second teaser film. The AI character asks questions, extracts the narrative, and generates a structured script document that feeds into a downstream AI film production pipeline.

This is **Screen 1 of a larger platform** that will eventually include three AI personas:
1. **Story Writer** (Hank Moody) — built ✓
2. **Script Visualizer** — future
3. **Sound Designer** — future

---

## The User Journey (End to End)

```
[Landing Page]
    ↓  Director clicks "Begin Session"

[Director's Room]
    ↓  Runway realtime session created (server-side)
    ↓  Hank Moody avatar appears via WebRTC — live video + voice
    ↓  Hank asks questions about the 30-second teaser:
         - Who is the central character?
         - What happens in those 30 seconds?
         - What's the tone/mood/visual style?
         - What's the narrative arc?
    ↓  Director responds by speaking (mic only, no text input)
    ↓  Live transcript scrolls in the right panel
    ↓  Director clicks "Finish & Generate Script" (or confirms verbally)

[Script Review]
    ↓  Raw transcript sent to OpenAI → structured JSON script document
    ↓  Director sees formatted script with all sections
    ↓  All fields are editable inline before approving
    ↓  Director clicks "Send to Production"

[Holding Screen]
    →  "Your teaser is being built..."
    →  Script JSON POSTed to backend (FastAPI)
    →  Backend agents take over to build the film
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Avatar / Real-time video | Runway Characters API (`@runwayml/avatars-react` v0.15, `@runwayml/sdk` v3.21) |
| LLM (script formatting) | OpenAI-compatible API (`gpt-5.5` via `opencode.ai/zen/v1`) |
| Backend (mocked) | FastAPI — `http://localhost:8000` placeholder |
| Runtime | Node.js 25, npm 11 |

---

## Project Structure

```
directors-room/
│
├── .env.local                          # All secrets (see Environment Variables section)
├── package.json
├── tailwind.config.ts
│
├── app/
│   ├── layout.tsx                      # Root layout — dark bg, font setup
│   ├── globals.css                     # Tailwind base + custom animations (grain, mic pulse, breathe)
│   ├── page.tsx                        # Screen 1: Landing page
│   ├── room/
│   │   └── page.tsx                    # Screen 2: Director's Room (main experience)
│   └── script/
│       └── page.tsx                    # Screen 3: Script Review + Send to Production
│
├── app/api/
│   ├── avatar/session/route.ts         # POST — creates Runway realtime session (server-side only)
│   ├── format-script/route.ts          # POST — fetches transcript → OpenAI → structured JSON
│   └── submit-script/route.ts          # POST — mocked FastAPI proxy (swap for real endpoint)
│
├── components/
│   ├── AvatarView.tsx                  # Runway AvatarSession + useTranscription hook integration
│   ├── TranscriptPanel.tsx             # Live scrolling HANK / YOU conversation log
│   ├── MicIndicator.tsx                # Pulsing dot mic status pill
│   └── ScriptDocument.tsx              # Editable structured script renderer (all fields)
│
└── lib/
    ├── types.ts                        # ScriptDocument, TranscriptEntry, SessionCredentials types
    ├── runway.ts                       # Server-only Runway SDK singleton
    └── openai.ts                       # OpenAI client + SCRIPT_FORMATTING_PROMPT
```

---

## Environment Variables

File: `.env.local` (already created, do not commit to git)

```env
# Runway Characters API — used server-side only, never exposed to client
RUNWAYML_API_SECRET=key_7d38287...

# OpenAI-compatible LLM endpoint — used server-side only
OPENAI_API_KEY=sk-jzEyGEWK...
OPENAI_BASE_URL=https://opencode.ai/zen/v1
OPENAI_MODEL=gpt-5.5

# Runway avatar ID — the Hank Moody character (safe to expose, it's just an ID)
NEXT_PUBLIC_AVATAR_ID=65263cf5-a921-4338-81d6-b7d436f97738

# FastAPI backend base URL — swap this when backend is ready
FASTAPI_BASE_URL=http://localhost:8000
```

> **Security note**: `RUNWAYML_API_SECRET` and `OPENAI_API_KEY` are only used in `app/api/` routes (server-side). They are never sent to the browser. `NEXT_PUBLIC_AVATAR_ID` is safe to expose — it's just the avatar identifier.

---

## The Runway Characters API

**What it is**: Runway launched Characters in March 2026 — a real-time conversational avatar API powered by GWM-1 (General World Model). Takes a single reference image and turns it into a live, speaking, lip-syncing video agent.

**How it works in this project**:

1. Director visits `/room` → browser calls `POST /api/avatar/session`
2. Server-side: `client.realtimeSessions.create(...)` with avatar ID + personality prompt
3. Server polls `GET /v1/realtime_sessions/:id` until status is `READY`
4. Server calls `POST /v1/realtime_sessions/:id/consume` → gets WebRTC credentials
5. Credentials returned to client (never the API key)
6. Client: `<AvatarSession credentials={...}>` establishes WebRTC connection via LiveKit
7. Hank Moody is live — audio in both directions, avatar video rendered via `<AvatarVideo />`

**Session limits**: Max 5 minutes per session (Runway platform limit). Suitable for a 30-second film pitch.

**The Hank Moody Character**:
- Avatar ID: `65263cf5-a921-4338-81d6-b7d436f97738`
- Created in Runway Developer Portal at `dev.runwayml.com` → Characters tab
- Reference image: Hank Moody / David Duchovny from Californication
- Personality and starting script are injected per-session via `personality` and `startScript` fields (not stored in the portal — this gives us flexibility to update without touching the portal)

**Personality prompt** (set in `app/api/avatar/session/route.ts`):
```
You are Hank Moody — a brilliant, sardonic, deeply literary screenwriter...
[covers: character, scene, tone, visual mood, narrative arc — all constrained to 30 seconds]
```

**Starting script**:
```
*leans back, lights up* Alright. You've got my attention and about five minutes 
before I lose it. Tell me — what's the one image you want burned into someone's 
brain. Thirty seconds. Go.
```

---

## Transcript Capture

Two-layer approach for reliability:

**Layer 1 (preferred)**: After session ends, `GET /v1/avatar_conversations/:sessionId` from Runway's REST API. This returns a clean, authoritative transcript with `role: 'assistant'` / `role: 'user'` entries.

**Layer 2 (fallback)**: During the session, `useTranscription()` hook from `@runwayml/avatars-react` fires on each finalized speech segment. `entry.participantIdentity === 'agent'` = Hank speaking. Anything else = director. This is accumulated in React state and sent as `transcriptFallback` in the format-script POST body.

The format-script route tries Layer 1 first, falls back to Layer 2 automatically.

---

## Script Formatting (OpenAI)

After the session ends, the raw transcript is sent to:
- **Endpoint**: `https://opencode.ai/zen/v1/chat/completions`
- **Model**: `gpt-5.5`
- **System prompt**: instructs the model to extract structured fields from a messy conversation

**Output schema** (`lib/types.ts → ScriptDocument`):

```typescript
{
  title: string                       // Short evocative title
  logline: string                     // 1-2 sentence summary
  genre: string                       // drama, thriller, noir, sci-fi, etc.
  tone: string                        // melancholic, tense, hopeful, gritty, etc.
  duration: "30 seconds"              // always fixed
  characters: Array<{
    name: string
    role: "protagonist" | "antagonist" | "supporting"
    description: string
  }>
  scene: {
    setting: string                   // physical location
    time_of_day: string               // morning, night, golden hour, etc.
    mood: string                      // atmospheric mood
    action: string                    // what happens in the 30 seconds
    dialogue_hints: string[]          // key lines or dialogue direction
  }
  visual_style: string                // cinematographic style, color palette, camera
  narrative_arc: string               // setup → moment → resolution (compressed)
}
```

The model is instructed to infer missing fields creatively rather than leave anything empty. Temperature is set to 0.3 for consistency.

---

## Backend Integration (FastAPI)

### Current State (Mocked)

`app/api/submit-script/route.ts` currently returns:
```json
{ "status": "accepted", "jobId": "job_<timestamp>", "message": "..." }
```

### How to Swap In the Real Backend

In `app/api/submit-script/route.ts`, replace the mock block with:

```typescript
const response = await fetch(`${process.env.FASTAPI_BASE_URL}/api/v1/submit-script`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ script }),
})
const data = await response.json()
return NextResponse.json(data)
```

Update `FASTAPI_BASE_URL` in `.env.local` to point to the real backend.

### What the Backend Receives

A single POST body:
```json
{
  "script": {
    "title": "...",
    "logline": "...",
    "genre": "...",
    "tone": "...",
    "duration": "30 seconds",
    "characters": [...],
    "scene": { ... },
    "visual_style": "...",
    "narrative_arc": "..."
  }
}
```

This is the complete structured document for the AI agent to begin building the teaser film.

---

## API Routes Reference

### `POST /api/avatar/session`

Creates a Runway realtime session. Called on mount of `/room`.

**Request body:**
```json
{ "avatarId": "65263cf5-a921-4338-81d6-b7d436f97738" }
```

**Response:**
```json
{
  "sessionId": "uuid",
  "serverUrl": "wss://...",
  "token": "...",
  "roomName": "..."
}
```

**Server-side only.** Never call this from an external client — the Runway API key is used here.

---

### `POST /api/format-script`

Fetches transcript from Runway + formats via OpenAI.

**Request body:**
```json
{
  "sessionId": "uuid",
  "avatarId": "uuid",
  "transcriptFallback": "HANK: ...\nDIRECTOR: ..."
}
```

**Response:**
```json
{ "script": { ...ScriptDocument } }
```

---

### `POST /api/submit-script`

Sends the final approved script to the production pipeline.

**Request body:**
```json
{ "script": { ...ScriptDocument } }
```

**Response (mocked):**
```json
{ "status": "accepted", "jobId": "job_123", "message": "..." }
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:3000

# Build (type-check + production build)
npm run build
```

Browser will prompt for **microphone permission** when `/room` loads. This must be granted for the director to speak to Hank.

---

## Design Decisions

| Decision | Rationale |
|---|---|
| No Redux / Zustand | Session is single-use, `useState` + `sessionStorage` is sufficient. No overengineering. |
| `sessionStorage` for script data | Passes script from `/room` to `/script` without a database. Cleared on tab close. |
| Dynamic import for `AvatarView` | WebRTC APIs don't exist in SSR context. `dynamic(..., { ssr: false })` prevents server-side crash. |
| Server-side session creation | Runway API key never touches the client. Only WebRTC credentials (time-limited, single-use) are passed to the browser. |
| Client transcript fallback | Runway's conversation API needs time to process after session ends. Client-side accumulation via `useTranscription` ensures we always have something to send to OpenAI. |
| `participantIdentity === 'agent'` | How the Runway React SDK identifies the avatar vs. user in `TranscriptionEntry`. |
| Tailwind CSS only | No component library — keeps bundle minimal, full visual control, no design system needed for hackathon. |
| Film grain via CSS SVG filter | Pure CSS, no image asset. `body::after` pseudo-element with `opacity: 0.03` adds cinematic texture without any visual noise. |

---

## Known Constraints & Future Work

### Current Constraints
- **5-minute session limit** per Runway API session. Sufficient for a 30-second film pitch.
- **No session resume** — each "Begin Session" is a fresh Runway session. Prior conversation cannot be continued.
- **Desktop only** — layout is fixed-split 65/35, not responsive to mobile.
- **No auth** — prototype only. Any visitor can start a session.
- **Mocked backend** — `submit-script` does not call real FastAPI yet.

### Adding Inline Editing (Low effort, ~1-2 hours)
All script fields in `ScriptDocument.tsx` are already editable via `<input>` and `<textarea>` with `onChange` handlers. State is lifted to `ScriptPage` via `onChange` prop. This is fully wired — edits are reflected in the script object that gets submitted.

### Adding "Back to Room" / Re-interview (Medium effort)
Sessions are not resumable. To "go back and add more", options are:
- **Option A**: Start a new Runway session with the prior transcript injected into `startScript` as context (e.g. "You already discussed X, Y, Z. Continue from here."). ~3-4 hours.
- **Option B**: Let the director amend the structured fields directly in Script Review (already supported via Option A above — inline editing). ~0 hours, already works.

### Adding the Other Two Personas (Medium effort per persona)
- Create a new avatar in Runway Dev Portal (new image + voice)
- Add a new route `/api/avatar/session-visualizer` with a different `personality` prompt
- Add `/visualizer` page using the same `AvatarView` + `TranscriptPanel` pattern
- Chain: after Story Writer finishes → navigate to Script Visualizer session

### Production Readiness Checklist
- [ ] Swap `FASTAPI_BASE_URL` to real backend URL
- [ ] Add error monitoring (Sentry or similar)
- [ ] Add session timeout UI (warn director at 4:00, hard stop at 5:00)
- [ ] Rate limit the `/api/avatar/session` route (one session per IP or per session token)
- [ ] Add "Powered by Runway" logo asset (currently text only — Runway branding policy requires logo)
- [ ] Remove API keys from `.env.local` and rotate before any public deployment

---

## Repository Layout (Full)

```
directors-room/
├── .env.local                              ← secrets, do not commit
├── package.json                            ← dependencies + scripts
├── tsconfig.json                           ← TypeScript config
├── tailwind.config.ts                      ← Tailwind config
├── next.config.ts                          ← Next.js config
├── PROJECT.md                              ← this file
│
├── app/
│   ├── layout.tsx                          ← root layout
│   ├── globals.css                         ← global styles + animations
│   ├── page.tsx                            ← / Landing
│   ├── room/
│   │   └── page.tsx                        ← /room Director's Room
│   └── script/
│       └── page.tsx                        ← /script Script Review
│
├── app/api/
│   ├── avatar/session/route.ts             ← POST /api/avatar/session
│   ├── format-script/route.ts             ← POST /api/format-script
│   └── submit-script/route.ts             ← POST /api/submit-script
│
├── components/
│   ├── AvatarView.tsx                      ← Runway SDK integration
│   ├── TranscriptPanel.tsx                 ← live transcript UI
│   ├── MicIndicator.tsx                    ← mic status
│   └── ScriptDocument.tsx                  ← editable script form
│
└── lib/
    ├── types.ts                            ← TypeScript types
    ├── runway.ts                           ← Runway SDK client (server-only)
    └── openai.ts                           ← OpenAI client + system prompt
```

---

*Built for the Runway ML Hackathon — May 2026*
