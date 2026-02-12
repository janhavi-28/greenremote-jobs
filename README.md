This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Add environment variables (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy. The app uses the App Router and server-side job fetching; no extra config needed.

## Importing jobs from external APIs

The app can pull jobs from **Remotive**, **RemoteOK**, and **ArbeitNow** (all free, no API keys required) and upsert them into Supabase. Duplicates are skipped using `apply_url`.

**Trigger a fetch (e.g. after starting the dev server):**

```bash
curl http://localhost:3000/api/fetch-jobs
```

Or open `GET /api/fetch-jobs` in your browser. The response includes how many jobs were fetched per source and how many were newly inserted. Run this periodically (e.g. once or twice per day) to keep listings fresh. On Vercel you can call this route from a [cron job](https://vercel.com/docs/cron-jobs).

## Production & scale

- **Jobs** are fetched server-side on `/jobs` with filters and pagination; the API supports `search`, `location`, `category`, `experience`, `remote`, `sort`, `page`, `limit`.
- **Performance**: The jobs API selects only needed columns and uses a single Supabase query with `count: "exact"`. Add DB indexes on `jobs(location)`, `jobs(category)`, `jobs(experience_level)`, `jobs(created_at)` if you grow.
- **Scaling**: Use Vercel’s serverless functions and Supabase connection pooling (Supavisor) for higher traffic.
