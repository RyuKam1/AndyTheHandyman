function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const RATIO_KEYS = new Set([
  "ratio-3-2",
  "ratio-4-3",
  "ratio-5-4",
  "ratio-16-10",
  "ratio-16-9",
  "ratio-custom",
  "ratio-4-5",
  "ratio-1-1",
  "ratio-3-4",
  "ratio-21-9",
]);
const DISPLAY_RATIO_KEYS = new Set(
  [...RATIO_KEYS].filter((key) => key !== "ratio-custom"),
);

export function normalizeContentBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return [];

  return blocks
    .map((block) => {
      if (!block || typeof block !== "object") return null;
      const props =
        block.props && typeof block.props === "object" ? block.props : {};
      const type = block.type === "pros-cons" ? "proscons" : block.type;

      if (!type) return null;
      return {
        id: block.id || crypto.randomUUID(),
        type,
        ...props,
        ...Object.fromEntries(
          Object.entries(block).filter(
            ([key]) => !["id", "type", "props"].includes(key),
          ),
        ),
      };
    })
    .filter(Boolean);
}

export function postSummaryFromRow(row) {
  const previewText = extractPreviewText(row.content);
  const coverLibrary = Array.isArray(row.cover_image_library)
    ? row.cover_image_library
    : [];
  const selectedFromRow = String(row.cover_image_selected || "").trim();
  const selectedFromLibrary = coverLibrary.some(
    (item) => String(item?.id || "").trim() === selectedFromRow,
  )
    ? selectedFromRow
    : String(coverLibrary[0]?.id || "").trim();
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    tags: row.tags || [],
    coverImage: row.cover_image,
    coverImageSelected: selectedFromLibrary,
    coverImageLibrary: coverLibrary,
    coverImageVariants:
      row.cover_image_variants && typeof row.cover_image_variants === "object"
        ? row.cover_image_variants
        : {},
    coverImageCrops: normalizeCoverImageCrops(row.cover_image_crops),
    coverImagePostRatio:
      typeof row.cover_image_post_ratio === "string" &&
      RATIO_KEYS.has(row.cover_image_post_ratio)
        ? row.cover_image_post_ratio
        : "ratio-16-9",
    coverImageDisplayRatios: Array.isArray(row.cover_image_display_ratios)
      ? row.cover_image_display_ratios.filter((key) =>
          DISPLAY_RATIO_KEYS.has(String(key)),
        )
      : [],
    coverImageCustomEnabled: Boolean(row.cover_image_custom_enabled),
    coverImageCustomSize: normalizeCustomSize(row.cover_image_custom_size),
    date: row.published_on,
    featured: row.featured_rank,
    contentPreview: previewText
      ? [{ type: "paragraph", text: previewText }]
      : [],
  };
}

function extractPreviewText(content) {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (block?.type === "paragraph" && typeof block.text === "string") {
      return block.text.trim().slice(0, 180);
    }
  }
  return "";
}

export function postDetailFromRow(row) {
  const coverLibrary = Array.isArray(row.cover_image_library)
    ? row.cover_image_library
    : [];
  const selectedFromRow = String(row.cover_image_selected || "").trim();
  const selectedFromLibrary = coverLibrary.some(
    (item) => String(item?.id || "").trim() === selectedFromRow,
  )
    ? selectedFromRow
    : String(coverLibrary[0]?.id || "").trim();
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || "",
    author: row.author || "Andy",
    category: row.category,
    tags: row.tags || [],
    date: row.published_on,
    coverImage: row.cover_image || "",
    coverImageSelected: selectedFromLibrary,
    coverImageLibrary: coverLibrary,
    coverImageVariants:
      row.cover_image_variants && typeof row.cover_image_variants === "object"
        ? row.cover_image_variants
        : {},
    coverImageCrops: normalizeCoverImageCrops(row.cover_image_crops),
    coverImagePostRatio:
      typeof row.cover_image_post_ratio === "string" &&
      RATIO_KEYS.has(row.cover_image_post_ratio)
        ? row.cover_image_post_ratio
        : "ratio-16-9",
    coverImageDisplayRatios: Array.isArray(row.cover_image_display_ratios)
      ? row.cover_image_display_ratios.filter((key) =>
          DISPLAY_RATIO_KEYS.has(String(key)),
        )
      : [],
    coverImageCustomEnabled: Boolean(row.cover_image_custom_enabled),
    coverImageCustomSize: normalizeCustomSize(row.cover_image_custom_size),
    excerpt: row.excerpt || "",
    affiliateUrl: row.affiliate_url || "",
    affiliateButtonText:
      row.affiliate_button_text || "Check Price & Availability",
    affiliateButtonAlign: row.affiliate_button_align || "center",
    affiliateButtonBgColor: row.affiliate_button_bg_color || "",
    affiliateButtonTextColor: row.affiliate_button_text_color || "",
    seoTitle: row.seo_title || "",
    seoDescription: row.seo_description || "",
    featured: row.featured_rank ?? null,
    content: Array.isArray(row.content) ? row.content : [],
  };
}

export function parseListParams(query = {}) {
  return {
    category: typeof query.category === "string" ? query.category.trim() : "",
    search: typeof query.query === "string" ? query.query.trim() : "",
    sort:
      query.sort === "oldest"
        ? "oldest"
        : query.sort === "az"
          ? "az"
          : query.sort === "za"
            ? "za"
            : "newest",
    limit: Math.min(Math.max(toInt(query.limit, 50), 1), 100),
  };
}

export function normalizeIncomingPost(payload = {}) {
  const title = String(payload.title || "").trim();
  const slug = String(
    payload.slug ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
  ).trim();
  if (!title || !slug) {
    throw new Error("Title and slug are required.");
  }

  const tags = Array.isArray(payload.tags)
    ? payload.tags
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean)
    : [];

  const coverImageLibrary = Array.isArray(payload.coverImageLibrary)
    ? payload.coverImageLibrary
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const src = String(item.src || "").trim();
          if (!src) return null;
          return {
            id: String(item.id || crypto.randomUUID()).trim().slice(0, 120),
            src,
            label: String(item.label || "").trim().slice(0, 140),
          };
        })
        .filter(Boolean)
    : [];
  const requestedSelectedId = String(payload.coverImageSelected || "")
    .trim()
    .slice(0, 120);
  const hasSelectedInLibrary = coverImageLibrary.some(
    (item) => String(item?.id || "").trim() === requestedSelectedId,
  );
  const coverImageSelected = hasSelectedInLibrary
    ? requestedSelectedId
    : String(coverImageLibrary[0]?.id || "");

  const coverImageVariants = normalizeCoverImageVariants(payload.coverImageVariants);
  const coverImageCrops = normalizeCoverImageCrops(payload.coverImageCrops);
  const coverImagePostRatio =
    typeof payload.coverImagePostRatio === "string" &&
    RATIO_KEYS.has(payload.coverImagePostRatio)
      ? payload.coverImagePostRatio
      : "ratio-16-9";
  const coverImageDisplayRatios = Array.isArray(payload.coverImageDisplayRatios)
    ? [
        ...new Set(
          payload.coverImageDisplayRatios
            .map((k) => String(k))
            .filter((k) => DISPLAY_RATIO_KEYS.has(k)),
        ),
      ]
    : [];
  const coverImageCustomEnabled = Boolean(payload.coverImageCustomEnabled);
  const coverImageCustomSize = normalizeCustomSize(payload.coverImageCustomSize);

  return {
    slug,
    title,
    subtitle: String(payload.subtitle || "").trim(),
    author: String(payload.author || "Andy").trim() || "Andy",
    category: String(payload.category || "").trim() || "General",
    tags: [...new Set(tags)],
    publishedOn: String(payload.date || new Date().toISOString().slice(0, 10)),
    coverImage: String(payload.coverImage || "").trim(),
    coverImageSelected,
    coverImageLibrary,
    coverImageVariants,
    coverImageCrops,
    coverImagePostRatio,
    coverImageDisplayRatios,
    coverImageCustomEnabled,
    coverImageCustomSize,
    excerpt: String(payload.excerpt || "")
      .trim()
      .slice(0, 420),
    affiliateUrl: String(
      payload.affiliateUrl || payload.affiliateLink || "",
    ).trim(),
    affiliateButtonText: String(payload.affiliateButtonText || "").trim(),
    affiliateButtonAlign: ["left", "center", "right"].includes(
      String(payload.affiliateButtonAlign || "").trim().toLowerCase(),
    )
      ? String(payload.affiliateButtonAlign).trim().toLowerCase()
      : "center",
    affiliateButtonBgColor: String(payload.affiliateButtonBgColor || "").trim().slice(0, 24),
    affiliateButtonTextColor: String(payload.affiliateButtonTextColor || "").trim().slice(0, 24),
    seoTitle: String(payload.seoTitle || "").trim(),
    seoDescription: String(payload.seoDescription || "")
      .trim()
      .slice(0, 420),
    featuredRank:
      payload.featured == null || payload.featured === ""
        ? null
        : Math.min(Math.max(toInt(payload.featured, null), 1), 3),
    content: normalizeContentBlocks(payload.content || []),
  };
}

function normalizeCoverImageVariants(value) {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value);
  const directRatioMode = entries.some(
    ([key, v]) => RATIO_KEYS.has(String(key)) && typeof v === "string" && v.trim(),
  );
  if (directRatioMode) {
    return Object.fromEntries(
      entries
        .filter(([key, v]) => RATIO_KEYS.has(String(key)) && typeof v === "string" && v.trim())
        .map(([key, v]) => [String(key), String(v).trim()]),
    );
  }

  const nested = {};
  for (const [sourceId, ratioMap] of entries) {
    if (typeof sourceId !== "string" || !ratioMap || typeof ratioMap !== "object") continue;
    const cleaned = Object.fromEntries(
      Object.entries(ratioMap)
        .filter(([ratioKey, src]) => RATIO_KEYS.has(String(ratioKey)) && typeof src === "string" && src.trim())
        .map(([ratioKey, src]) => [String(ratioKey), String(src).trim()]),
    );
    if (Object.keys(cleaned).length) nested[sourceId.slice(0, 120)] = cleaned;
  }
  return nested;
}

function normalizeCustomSize(value) {
  const widthRaw = Number.parseInt(String(value?.width ?? 1200), 10);
  const heightRaw = Number.parseInt(String(value?.height ?? 675), 10);
  const width = Number.isFinite(widthRaw) ? Math.min(2400, Math.max(280, widthRaw)) : 1200;
  const height = Number.isFinite(heightRaw) ? Math.min(2400, Math.max(220, heightRaw)) : 675;
  return { width, height };
}

function normalizeCoverImageCrops(value) {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value);
  const directRatioMode = entries.some(
    ([key, v]) => RATIO_KEYS.has(String(key)) && v && typeof v === "object",
  );
  if (directRatioMode) {
    return Object.fromEntries(
      entries
        .filter(([key, v]) => RATIO_KEYS.has(String(key)) && v && typeof v === "object")
        .map(([key, v]) => [String(key), normalizeSingleCrop(v)]),
    );
  }
  const nested = {};
  for (const [sourceId, ratioMap] of entries) {
    if (typeof sourceId !== "string" || !ratioMap || typeof ratioMap !== "object") continue;
    const cleaned = Object.fromEntries(
      Object.entries(ratioMap)
        .filter(([ratioKey, crop]) => RATIO_KEYS.has(String(ratioKey)) && crop && typeof crop === "object")
        .map(([ratioKey, crop]) => [String(ratioKey), normalizeSingleCrop(crop)]),
    );
    if (Object.keys(cleaned).length) nested[sourceId.slice(0, 120)] = cleaned;
  }
  return nested;
}

function normalizeSingleCrop(value) {
  const zoomRaw = Number.parseFloat(String(value?.zoom ?? 1));
  const offsetXPctRaw = Number.parseFloat(String(value?.offsetXPct ?? 0));
  const offsetYPctRaw = Number.parseFloat(String(value?.offsetYPct ?? 0));
  const zoom = Number.isFinite(zoomRaw) ? Math.min(4, Math.max(0.35, zoomRaw)) : 1;
  const offsetXPct = Number.isFinite(offsetXPctRaw)
    ? Math.min(120, Math.max(-120, offsetXPctRaw))
    : 0;
  const offsetYPct = Number.isFinite(offsetYPctRaw)
    ? Math.min(120, Math.max(-120, offsetYPctRaw))
    : 0;
  return { zoom, offsetXPct, offsetYPct };
}
