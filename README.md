# Qwezy — Query Easily (No-API Version)

Fully functional mock — runs with zero external services.

## Setup (3 commands)

```bash
npm install
npm run dev
```

Open http://localhost:3000

## What works right now
- Landing page with hero, features, pricing
- Full 4-step onboarding (connect → schema → annotate → done)
- Dashboard with all 4 tabs:
  - Ask Qwezy — type a question, watch AI status steps, SQL types out, results appear
  - DB Explorer — browse all 8 tables organized by team
  - Query Builder — search columns, add to canvas, generate query
  - Usage — stats, table health, API cost breakdown

## When you're ready to go live
Swap out the mock API routes:
- `app/api/query/route.ts` → real Claude API + real DB connection
- `app/api/annotate/route.ts` → real Claude API

Add these packages:
```bash
npm install @anthropic-ai/sdk @supabase/supabase-js pg
```

Then add a `.env.local` file:
```
ANTHROPIC_API_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## Deploy to Vercel (free)
```bash
npx vercel
```
