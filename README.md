# Make It Grain POS

A small POS, inventory, and monthly reporting app for film sales. The frontend
is a React/Vite app; the backend is an Express API connected to Supabase
PostgreSQL.

## Run locally

Open two terminal windows.

1. Start the backend:

   ```sh
   cd backend
   cp .env.example .env
   # Add the Supabase DATABASE_URL to .env. Never commit this file.
   npm install
   npm run dev
   ```

2. Start the frontend:

   ```sh
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

Open the local Vite address shown in the frontend terminal (normally
`http://127.0.0.1:5175`). The frontend calls `http://localhost:5001` by
default; set `VITE_API_BASE_URL` in `frontend/.env` only when using another API
address.

## Check that the backend is working

Open [http://localhost:5001/api/health](http://localhost:5001/api/health).
It should return:

```json
{ "status": "ok", "database": "connected" }
```

This check only pings the database; it does not read or change order or stock
data.

## Validate before a commit or deployment

```sh
cd backend && npm test
cd frontend && npm run lint && npm run build
```

## Operating rules

- Use **Cancel** for a completed order that should be reversed. It restores
  stock and keeps the order for audit history.
- Use **Delete** only for an order created by mistake and that should leave no
  history.
- Receive every delivery through **Stock actions → Receive stock**. This
  creates the FIFO batch used for cost and margin calculations.
- Record non-sale withdrawals through **Stock actions → Personal use**.
- The database stores precise FIFO cost calculations; the UI rounds displayed
  amounts to the nearest VND.
- `backend/.env` is a secret local file and is ignored by Git. Do not paste its
  database password into GitHub, chat, or the frontend.

## Project status

The completed work and current next phase are tracked in
[`.planning/STATE.md`](.planning/STATE.md).

## Netlify deployment preparation

The repository includes a Netlify configuration that builds the frontend and
routes `/api/*` through the existing Express app as a Netlify Function. Before
publishing it, configure Supabase Auth and these Netlify environment variables:

- `DATABASE_URL` — Supabase **Session Pooler** connection string
- `DATABASE_SSL=true`
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

Do not set `VITE_API_BASE_URL` for the deployed site: the frontend uses the
same deployed domain's `/api` routes automatically.

The deployed app uses a Supabase magic link. Create the owner user in Supabase
Auth first, then add the final Netlify URL to Supabase Auth's allowed redirect
URLs and Site URL settings. The backend rejects every deployed `/api` request
without a verified Supabase session.
