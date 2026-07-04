// In-memory contents of a packaged .timeline opened in the web viewer.
// Desktop-only note/asset references resolve against this store instead of
// the filesystem when running in the browser.

let current = null; // { notes: { rel: string }, assetUrls: { rel: blobUrl } }

// Mirrors sanitizeNoteFilename in electron/main.cjs so bare noteFile refs
// find the entry the desktop app would have written
const sanitizeNoteFilename = (value) => {
  const base = String(value || "").replace(/\.md$/i, "");
  const cleaned = base
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${cleaned || "note"}.md`;
};

const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
};

// pkg: { notes, assets } from packageReader; pass null to clear
export function setViewerPackage(pkg) {
  if (current) {
    Object.values(current.assetUrls).forEach((url) => URL.revokeObjectURL(url));
  }
  if (!pkg) {
    current = null;
    return;
  }
  const assetUrls = {};
  for (const [rel, bytes] of Object.entries(pkg.assets || {})) {
    const ext = rel.split(".").pop().toLowerCase();
    assetUrls[rel] = URL.createObjectURL(new Blob([bytes], { type: MIME_BY_EXT[ext] || "application/octet-stream" }));
  }
  current = { notes: pkg.notes || {}, assetUrls };
}

export function getPackageNote(filename) {
  if (!current) return null;
  const raw = String(filename || "").replace(/\\/g, "/");
  if (Object.prototype.hasOwnProperty.call(current.notes, raw)) return current.notes[raw];
  if (!raw.includes("/")) {
    const sanitized = sanitizeNoteFilename(raw);
    if (Object.prototype.hasOwnProperty.call(current.notes, sanitized)) return current.notes[sanitized];
  }
  return null;
}

export function resolvePackageAssetSrc(src) {
  if (!current) return null;
  const key = String(src || "").replace(/\\/g, "/");
  return current.assetUrls[key] || null;
}
