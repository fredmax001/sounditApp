/**
 * Slug utilities for human-readable & SEO-friendly URLs.
 * Matches backend utils/slug.py behavior.
 */

export function slugify(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove invalid characters
    .replace(/[\s_-]+/g, '-') // collapse whitespace/underscores into single hyphen
    .replace(/^-+|-+$/g, ''); // trim leading and trailing hyphens
}

/**
 * Helper to get the canonical URL identifier for an entity:
 * Prefers slug, then slugified name/title, and falls back to id.
 */
export function getEntitySlug(
  item: { slug?: string | null; id?: number | string; [key: string]: any } | null | undefined,
  nameField?: string
): string {
  if (!item) return '';
  if (item.slug && item.slug.trim()) {
    return item.slug.trim();
  }
  if (nameField && item[nameField]) {
    const slug = slugify(String(item[nameField]));
    if (slug) return slug;
  }
  return item.id !== undefined && item.id !== null ? String(item.id) : '';
}
