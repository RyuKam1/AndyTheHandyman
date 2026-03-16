import { neon } from "@neondatabase/serverless";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.HANDY_DATABASE_URL ||
  process.env.HANDY_POSTGRES_URL ||
  process.env.HANDY_POSTGRES_PRISMA_URL;

export const sql = DATABASE_URL ? neon(DATABASE_URL) : null;
let schemaReadyPromise = null;

export async function ensureSchema() {
  if (!sql) {
    throw new Error(
      "DATABASE_URL/POSTGRES_URL is not configured on the server.",
    );
  }

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
        cover_image_selected TEXT,
        cover_image_library JSONB NOT NULL DEFAULT '[]'::jsonb,
        cover_image_variants JSONB NOT NULL DEFAULT '{}'::jsonb,
        cover_image_crops JSONB NOT NULL DEFAULT '{}'::jsonb,
        cover_image_post_ratio VARCHAR(32),
        cover_image_display_ratios JSONB NOT NULL DEFAULT '[]'::jsonb,
        cover_image_custom_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        cover_image_custom_size JSONB NOT NULL DEFAULT '{"width":1200,"height":675}'::jsonb,
        excerpt VARCHAR(420) NOT NULL,
        affiliate_url TEXT,
        affiliate_button_text VARCHAR(80),
        affiliate_button_align VARCHAR(10),
        affiliate_button_bg_color VARCHAR(24),
        affiliate_button_text_color VARCHAR(24),
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
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS affiliate_button_align VARCHAR(10);`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS affiliate_button_bg_color VARCHAR(24);`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS affiliate_button_text_color VARCHAR(24);`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_selected TEXT;`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_library JSONB NOT NULL DEFAULT '[]'::jsonb;`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_variants JSONB NOT NULL DEFAULT '{}'::jsonb;`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_crops JSONB NOT NULL DEFAULT '{}'::jsonb;`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_post_ratio VARCHAR(32);`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_display_ratios JSONB NOT NULL DEFAULT '[]'::jsonb;`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_custom_enabled BOOLEAN NOT NULL DEFAULT FALSE;`;
    await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_custom_size JSONB NOT NULL DEFAULT '{"width":1200,"height":675}'::jsonb;`;
  })();

  return schemaReadyPromise;
}

export function isDatabaseConfigured() {
  return Boolean(DATABASE_URL);
}
