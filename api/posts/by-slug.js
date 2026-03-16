import { ensureSchema, sql } from "../_lib/db.js";
import { postDetailFromRow } from "../_lib/posts.js";

function getAdminApiKey() {
  return String(
    process.env.ADMIN_API_KEY || process.env.HANDY_ADMIN_API_KEY || "",
  ).trim();
}

function getSlug(req) {
  const raw = req.query?.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  return String(slug || "").trim();
}

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const slug = getSlug(req);
    if (!slug) {
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
        WHERE slug = ${slug}
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
      SELECT slug, title, subtitle, author, category, tags, published_on, cover_image, cover_image_selected, cover_image_library, cover_image_variants, cover_image_crops, cover_image_post_ratio, cover_image_display_ratios, cover_image_custom_enabled, cover_image_custom_size, excerpt,
             affiliate_url, affiliate_button_text, affiliate_button_align, affiliate_button_bg_color, affiliate_button_text_color, seo_title, seo_description, content, featured_rank
      FROM posts
      WHERE slug = ${slug}
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
