import { ensureSchema, sql } from "../_lib/db.js";
import { postDetailFromRow } from "../_lib/posts.js";

function getAdminApiKey() {
  return String(
    process.env.ADMIN_API_KEY || process.env.HANDY_ADMIN_API_KEY || "",
  ).trim();
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const slugFromQuery = req.query?.slug;
    const slugFromParams = req.params?.slug;
    const slug = slugFromQuery ?? slugFromParams;
    const safeSlug = Array.isArray(slug) ? slug[0] : slug;

    if (!safeSlug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    if (req.method === "DELETE") {
      const expectedKey = getAdminApiKey();
      const providedHeader = req.headers["x-admin-key"];
      const providedKey = Array.isArray(providedHeader)
        ? String(providedHeader[0] || "").trim()
        : String(providedHeader || "").trim();

      if (!expectedKey) {
        return res
          .status(500)
          .json({
            error: "Server missing ADMIN_API_KEY environment variable.",
          });
      }
      if (providedKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid API key." });
      }

      const deleted = await sql`
        DELETE FROM posts
        WHERE slug = ${safeSlug}
        RETURNING slug
      `;
      if (!deleted.length) {
        return res.status(404).json({ error: "Post not found" });
      }
      return res.status(200).json({ ok: true, slug: deleted[0].slug });
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, DELETE");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const rows = await sql`
      SELECT slug, title, subtitle, author, category, tags, published_on, cover_image, excerpt,
             affiliate_url, affiliate_button_text, seo_title, seo_description, content, featured_rank
      FROM posts
      WHERE slug = ${safeSlug}
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(404).json({ error: "Post not found" });
    }

    return res.status(200).json(postDetailFromRow(rows[0]));
  } catch (error) {
    return res
      .status(500)
      .json({ error: error?.message || "Database request failed." });
  }
}
