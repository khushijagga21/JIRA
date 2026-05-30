# Deploying workSphere

The app has two pieces that must be deployed separately:

| Piece | Tech | Where | Why |
|---|---|---|---|
| Frontend | React + Vite | **Vercel** (free) | Static site, fastest free CDN |
| Backend | Express + SQLite + WebSocket | **Render** (free) | Long-running Node + persistent disk + WebSocket support (Vercel does NOT support any of these) |

Total time: ~10 minutes. No credit card needed for either.

---

## 1. Push the repo to GitHub

If you haven't already:

```bash
git add .
git commit -m "Add deployment config"
git push
```

Your repo: `https://github.com/khushijagga21/JIRA`

---

## 2. Deploy the backend on Render

1. Go to **https://dashboard.render.com/blueprints**
2. Click **New Blueprint Instance**
3. Connect your GitHub account and pick the **JIRA** repo
4. Render reads `jira-ui/render.yaml` and shows the plan — accept it
5. Wait ~3 minutes for the first build (`npm install` rebuilds `better-sqlite3` for Linux)
6. When it's live, copy the public URL — e.g. `https://worksphere-api.onrender.com`

### Optional env vars (set in the Render dashboard → Environment)

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Enables the floating AI assistant |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Enables email invites |
| `PUBLIC_APP_URL` | Set this to your Vercel URL (step 3) so emailed invite links open the frontend |

> **Free tier note:** Render's free web services go to sleep after ~15 minutes of inactivity. The first request after sleep takes ~30s to wake up; subsequent requests are instant.

> **Free tier storage:** Persistent disks require a **paid** Render plan. The blueprint uses `/tmp/worksphere-data` instead (SQLite + uploads work, but **data resets when the service redeploys** or the instance is replaced). For production persistence, upgrade Render and add a disk — see `render.yaml` comments.

---

## 3. Deploy the frontend on Vercel

1. Go to **https://vercel.com/new**
2. Import the **JIRA** repo
3. **Root Directory:** set to `jira-ui`
4. Framework preset: **Vite** (auto-detected)
5. Add one environment variable:
   - `VITE_API_URL` = the Render URL from step 2 (e.g. `https://worksphere-api.onrender.com`)
6. Click **Deploy**
7. Vercel gives you a URL like `https://worksphere-chi.vercel.app`

---

## 4. Tell Render about Vercel

Back in the Render dashboard → your `worksphere-api` service → **Environment**:

1. Set `PUBLIC_APP_URL` = your Vercel URL (e.g. `https://worksphere-chi.vercel.app`)
2. Click **Save Changes** — Render auto-redeploys (~30s)

This makes emailed invite links and Meet share links point to the live frontend.

---

## 5. Test the live site

Open your Vercel URL and verify:

- [ ] Home page loads (theme toggle works)
- [ ] **workSphere chat** opens, you can sign up, create a room, and send a message
- [ ] **workSphere Whiteboard** (`/whiteboard`) — draw, **💾 Save**, then **✈ Send to chat**
- [ ] **workSphere To-Do** (`/todo`) — add a task, hit **✈** to share to a channel
- [ ] **workSphere Meet** (`/teams/meet`) — create a meeting, open in a second browser, both participants see each other (WebSocket signaling working)

---

## What lives where

| URL | Hosted on | What it serves |
|---|---|---|
| `https://worksphere-chi.vercel.app` | Vercel | React app (static files) |
| `https://worksphere-chi.vercel.app/api/*` | — | nothing; the frontend reads `VITE_API_URL` and fetches from Render directly |
| `https://worksphere-api.onrender.com/api/*` | Render | REST endpoints (chat, todo, auth, uploads) |
| `wss://worksphere-api.onrender.com/meet-ws` | Render | Meet signaling WebSocket |
| `/var/data/worksphere.db` (Render disk) | Render | SQLite database (persists across deploys) |
| `/var/data/uploads/collab/*` (Render disk) | Render | Uploaded files (images, PDFs) |

---

## Alternatives

If Render goes down or you'd rather use something else for the backend, the same `start` script works on any Node host:

- **Fly.io** — `fly launch` from `jira-ui/`, set `WORKSPHERE_DATA_DIR` to a mounted volume path. Free tier needs a credit card for verification.
- **Railway** — $5/month credit on the free trial.
- **Cyclic / Koyeb / Glitch** — smaller free tiers, all work with `npm start`.

For each, set the same env vars (`WORKSPHERE_DATA_DIR`, `PUBLIC_APP_URL`, optional `OPENAI_API_KEY` + SMTP) and point `VITE_API_URL` at the new URL.

---

## Troubleshooting

**Chat says "Could not reach the workSphere API"**
The `VITE_API_URL` on Vercel is wrong, OR your Render service is asleep. Open the Render dashboard, click your service, and wait for it to wake up. Then refresh the frontend.

**better-sqlite3 build fails on Render**
Render uses Node 20+ which already includes `node:sqlite` as a fallback. The server auto-detects this — no action needed. If you still see issues, set `NODE_VERSION=20` in Render env vars.

**Meet doesn't connect (camera shows but no remote peer)**
WebSocket isn't reaching the backend. Make sure the Render URL in `VITE_API_URL` uses `https://` (the client auto-upgrades to `wss://` for `/meet-ws`).

**Blueprint error: "disks are not supported for free tier services"**
Remove the `disk:` block from `render.yaml` (already fixed in the repo). Redeploy the blueprint. Free tier uses `/tmp/worksphere-data` instead — no persistent disk needed.

**Uploads disappeared after redeploy**
Confirm `WORKSPHERE_DATA_DIR=/var/data` is set in Render and that the **Disk** named `worksphere-data` is mounted at `/var/data`.
