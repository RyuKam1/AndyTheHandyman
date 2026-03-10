import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { normalizeIncomingPost } from '../api/_lib/posts.js';

dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL or POSTGRES_URL in .env.local');
}

const sql = neon(DATABASE_URL);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const postsDir = path.join(projectRoot, 'data', 'posts');

async function ensureSchema() {
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
}

async function readPostFiles() {
  const files = await readdir(postsDir);
  const jsonFiles = files.filter((name) => name.endsWith('.json'));

  const posts = [];
  for (const file of jsonFiles) {
    const fullPath = path.join(postsDir, file);
    const raw = await readFile(fullPath, 'utf8');
    const data = JSON.parse(raw);
    posts.push(data);
  }
  return posts;
}

async function seed() {
  await ensureSchema();
  const posts = await readPostFiles();

  let inserted = 0;
  for (const source of posts) {
    const post = normalizeIncomingPost({
      ...source,
      affiliateUrl: source.affiliateUrl || source.affiliateLink || '',
      featured: source.featured ?? null,
    });

    await sql`
      INSERT INTO posts (
        slug, title, subtitle, author, category, tags, published_on,
        cover_image, excerpt, affiliate_url, affiliate_button_text,
        seo_title, seo_description, content, featured_rank, updated_at
      )
      VALUES (
        ${post.slug}, ${post.title}, ${post.subtitle || null}, ${post.author}, ${post.category}, ${post.tags},
        ${post.publishedOn}, ${post.coverImage || null}, ${post.excerpt || ''}, ${post.affiliateUrl || null},
        ${post.affiliateButtonText || null}, ${post.seoTitle || null}, ${post.seoDescription || null},
        ${JSON.stringify(post.content)}, ${post.featuredRank}, now()
      )
      ON CONFLICT (slug)
      DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        author = EXCLUDED.author,
        category = EXCLUDED.category,
        tags = EXCLUDED.tags,
        published_on = EXCLUDED.published_on,
        cover_image = EXCLUDED.cover_image,
        excerpt = EXCLUDED.excerpt,
        affiliate_url = EXCLUDED.affiliate_url,
        affiliate_button_text = EXCLUDED.affiliate_button_text,
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        content = EXCLUDED.content,
        featured_rank = EXCLUDED.featured_rank,
        updated_at = now()
    `;
    inserted += 1;
  }

  console.log(`Seed complete. Upserted ${inserted} post(s).`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
