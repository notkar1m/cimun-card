# Cimun Card

Offers/loyalty platform: end users activate restaurant/cafe offers to get a one-time code, vendors redeem the code in person, and a superadmin manages offers, vendors, and user accounts.

Stack: Node.js + Express + TypeScript + Prisma (backend), React + Vite + TypeScript (frontend), PostgreSQL.

## Local development

Prerequisites: Node 20+, a local PostgreSQL instance.

```bash
npm install
createdb cimun_card          # or any Postgres database
cp .env.example backend/.env # then fill in DATABASE_URL and the other values
npm run prisma:migrate       # applies migrations, creates them if the schema changed
npm run seed                 # creates the initial superadmin from SEED_SUPERADMIN_EMAIL/PASSWORD
```

Run backend and frontend in separate terminals:

```bash
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:5173 (proxies /api to the backend)
```

Visit `http://localhost:5173/login/user`, `/login/vendor`, or `/login/admin`.

## Production build

```bash
npm run build   # builds frontend, builds backend, copies frontend/dist into backend/dist/public
npm start        # runs `prisma migrate deploy`, then starts the combined server on $PORT
```

In production the backend serves the built frontend as static files and handles `/api/*` — one process, one origin, no CORS.

## Deployment (Render or Railway)

One web service + one managed Postgres addon.

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start` (runs `prisma migrate deploy` before booting)
- **Env vars:** see `.env.example`. `DATABASE_URL` comes from the managed Postgres addon; set `JWT_SECRET`, `APP_URL` (the deployed URL, used in reset-password email links), and the `SMTP_*` vars for outbound mail.
- After the first deploy, run the seed script once from the platform's shell/console: `npm run seed`.

A `render.yaml` is included for Render's Blueprint deploys (Infrastructure as Code) — import the repo in the Render dashboard and it provisions the web service and database automatically; you'll still need to fill in the `sync: false` env vars (SMTP credentials, `APP_URL`) in the dashboard.

For Railway, create a Postgres plugin and a service pointed at this repo with the same build/start commands, and set the same environment variables (Railway auto-injects `DATABASE_URL` when you reference the Postgres plugin).

## Notes

- Codes never expire; redeemed activations are kept (never hard-deleted) as the audit/usage-history log.
- A vendor only ever sees pending codes and history for offers linked to their own account.
- Offers with activation history can't be hard-deleted — deactivate them instead (`active: false`).
