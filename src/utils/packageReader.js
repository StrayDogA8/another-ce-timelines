// Browser-side reader for the packaged .timeline format (zip with
// timeline.json + assets/ + notes/ + manifest.json). Mirrors
// electron/timelinePackage.cjs; keep the two in sync.
import { unzipSync, strFromU8 } from "fflate";

export const PACKAGE_FORMAT_VERSION = 1;

// Zip local-file-header magic; bare timelines start with '{'
export const isZipBuffer = (buf) =>
  Boolean(buf && buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b);

const sanitizeEntryPath = (name) => {
  const parts = String(name || "").split(/[/\\]/).filter((p) => p && p !== ".");
  if (parts.length === 0) return null;
  if (parts.some((p) => p === ".." || /^[a-zA-Z]:$/.test(p))) return null;
  return parts.join("/");
};

export function readPackage(buf) {
  const entries = unzipSync(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const timelineRaw = entries["timeline.json"];
  if (!timelineRaw) throw new Error("Package is missing timeline.json");

  let manifest = null;
  if (entries["manifest.json"]) {
    try { manifest = JSON.parse(strFromU8(entries["manifest.json"])); } catch { /* ignore */ }
  }

  const assets = {};
  const notes = {};
  for (const [name, data] of Object.entries(entries)) {
    if (name.endsWith("/")) continue; // directory entry
    if (name.startsWith("assets/")) {
      const rel = sanitizeEntryPath(name.slice("assets/".length));
      if (rel) assets[rel] = data;
    } else if (name.startsWith("notes/")) {
      const rel = sanitizeEntryPath(name.slice("notes/".length));
      if (rel) notes[rel] = strFromU8(data);
    }
  }
  return { timelineJson: strFromU8(timelineRaw), manifest, assets, notes };
}
