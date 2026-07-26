# Deployment checklist

## Render (apps/server)

1. Create a **Web Service** from this repository.
2. Set **Root Directory** to `apps/server` (or use repo-root `render.yaml`).
3. **Build**: from repo root, `npm ci && npm run build -w @slack-lite/shared && npm run build -w @slack-lite/server`
4. **Start**: `node dist/index.js`
5. Environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET` (Project Settings → API → JWT Secret, if using HS256 verification)
   - `CLIENT_ORIGIN` — e.g. `https://your-app.vercel.app,http://localhost:3000`

## Vercel (apps/web)

1. Import the GitHub repository.
2. Set **Root Directory** to `apps/web`.
3. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SOCKET_URL` — public URL of the Render socket service

## Post-deploy smoke test

1. Sign up two users in two browsers.
2. Create a channel and send messages — both clients should update in real time.
3. Start a DM and confirm presence dots change when one user closes the tab.
