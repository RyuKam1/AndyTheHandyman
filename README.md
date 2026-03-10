# Andy The Handyman

This project now uses Neon Postgres on Vercel for blog storage.

## Environment variables

Create `.env.local` (or configure in Vercel project settings):

- `DATABASE_URL` (or `POSTGRES_URL`)
- `ADMIN_API_KEY` (used by `/admin` publish action)

## Bootstrap database

Run once to create schema + import all existing JSON posts:

```bash
npm run db:bootstrap
```

## Localhost testing with database

To run the frontend and Vercel API locally (so Neon DB works on localhost):

```bash
npm run dev
```

This starts:
- Vite app on `http://localhost:5173`
- local Node API server on `http://localhost:3000`

Vite proxies `/api/*` to `localhost:3000`, so the browser still calls `/api/...` normally.

If you only want the API server:

```bash
npm run dev:api
```

## API endpoints

- `GET /api/posts` - list posts (supports `category`, `query`, `sort`, `limit`)
- `GET /api/posts/:slug` - get full post
- `GET /api/posts/by-slug?slug=...` - get full post (routing-safe variant)
- `DELETE /api/posts/:slug` - delete post (requires `x-admin-key`)
- `DELETE /api/posts/by-slug?slug=...` - delete post (routing-safe variant, requires `x-admin-key`)
- `GET /api/posts/related` - related posts
- `GET /api/categories` - categories list
- `GET /api/health` - deployment database health check
- `POST /api/posts` - create/update post (requires `x-admin-key`)

## Database optimization choices

- Uses compact `VARCHAR` lengths and `SMALLINT` for featured rank
- Stores only canonical post content (`JSONB`) and derives previews at read time
- Uses targeted indexes:
  - publish date index for main feed
  - `(category, published_on)` for category filtering
  - partial index for featured rows only
  - GIN index for tags array search
