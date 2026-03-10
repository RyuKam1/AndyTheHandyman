import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL (or POSTGRES_URL) environment variable.');
}

export const sql = neon(DATABASE_URL);
let schemaReadyPromise = null;

export async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS posts (
        id BIGSERIAL PRIMARY KEY,
        slug VARCHAR(120) UNIQUE NOT NULL,
        title VARCHAR(180) NOT NULL,
        subtitle VARCHAR(220),
        author VARCHAR(80) NOT NULL DEFAULT 'Andy',
        category VARCHAR(80) NOT NULL,
        tags TEXT[] NOT NULL DEFAULT '{}',
        published_on DATE NOT NULL,
        cover_image TEXT,
        excerpt VARCHAR(420) NOT NULL,
        affiliate_url TEXT,
        affiliate_button_text VARCHAR(80),
        seo_title VARCHAR(180),
        seo_description VARCHAR(420),
        content JSONB NOT NULL,
        featured_rank SMALLINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT posts_featured_rank_check CHECK (featured_rank IS NULL OR featured_rank BETWEEN 1 AND 3)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_posts_published_desc ON posts (published_on DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_posts_category_published ON posts (category, published_on DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_posts_featured_rank_partial ON posts (featured_rank) WHERE featured_rank IS NOT NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_posts_tags_gin ON posts USING GIN (tags);`;
  })();

  return schemaReadyPromise;
}
