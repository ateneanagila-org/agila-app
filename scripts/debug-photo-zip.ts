import "dotenv/config";
import JSZip from "jszip";
import { writeFileSync } from "fs";
import {
  connectToSheets,
  exportSpreadsheetAsZip,
} from "@/lib/services/helper.service";

async function main() {
  console.log("[DebugZip] Exporting catalog ZIP...");
  const { glAuth } = await connectToSheets();
  const zipBuffer = await exportSpreadsheetAsZip(
    process.env.CATALOG_SPREADSHEET_ID!,
    glAuth,
  );

  writeFileSync("catalog-debug.zip", zipBuffer);
  console.log(`[DebugZip] Saved catalog-debug.zip (${zipBuffer.length} bytes)`);

  const zip = await JSZip.loadAsync(zipBuffer);

  const allFiles = Object.keys(zip.files);
  console.log(`\n=== ZIP CONTENTS (${allFiles.length} entries) ===`);
  for (const name of allFiles) {
    const f = zip.files[name];
    const size = f.dir ? "<dir>" : "file";
    console.log(`  ${name}  (${size})`);
  }

  const htmlFiles = allFiles.filter((n) => n.toLowerCase().endsWith(".html") || n.toLowerCase().endsWith(".htm"));
  console.log(`\n=== HTML FILES: ${htmlFiles.length} ===`);

  // Image-like file entries — moved up before gidSet extraction
  const imageEntries = allFiles.filter((n) =>
    /\.(png|jpe?g|gif|webp|svg)$/i.test(n),
  );
  console.log(`\n=== IMAGE FILES IN ZIP: ${imageEntries.length} ===`);
  for (const n of imageEntries.slice(0, 10)) console.log(`  ${n}`);

  if (htmlFiles.length === 0) {
    console.log("No HTML files found. Listing first 30 entries by extension:");
    const ext = new Map<string, number>();
    for (const n of allFiles) {
      const m = n.match(/\.([^.\/]+)$/);
      const e = m ? m[1].toLowerCase() : "(no ext)";
      ext.set(e, (ext.get(e) ?? 0) + 1);
    }
    console.log("Extension counts:", Object.fromEntries(ext));
    process.exit(0);
  }

  // Find the HTML file that corresponds to a sheet with images.
  // Image filenames encode the sheet's numeric GID: cellImage_{gid}_{index}.jpg
  // Extract GIDs from image filenames and match to HTML files via <_config.html> or heuristic.
  const gidSet = new Set<string>();
  for (const name of imageEntries) {
    const m = name.match(/cellImage_(\d+)_\d+/);
    if (m) gidSet.add(m[1]);
  }
  console.log(`\n=== SHEET GIDs WITH IMAGES: ${[...gidSet].join(", ")} ===`);

  // Read _config.html or try to find GID→sheet name mapping
  if (zip.files["_config.html"]) {
    const cfg = await zip.files["_config.html"].async("text");
    console.log(`\n_config.html content:\n${cfg.slice(0, 2000)}`);
  }

  // Sample the LARGEST HTML file (most likely to have cats with photos)
  const htmlWithSizes = await Promise.all(
    htmlFiles.map(async (name) => {
      const content = await zip.files[name].async("text");
      return { name, content, size: content.length };
    }),
  );
  htmlWithSizes.sort((a, b) => b.size - a.size);
  const sample = htmlWithSizes[0];

  console.log(`\n=== SAMPLING LARGEST: ${sample.name} (${sample.size} chars) ===`);
  const html = sample.content;

  // Check for img tags
  const imgMatches = [...html.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
  console.log(`\n<img> tag count: ${imgMatches.length}`);
  for (const tag of imgMatches.slice(0, 10)) console.log(`  ${tag.slice(0, 300)}`);

  // background-image
  const bgMatches = [...html.matchAll(/background-image\s*:\s*url\(([^)]+)\)/gi)];
  console.log(`\nbackground-image url() count: ${bgMatches.length}`);
  for (const m of bgMatches.slice(0, 5)) console.log(`  ${m[0].slice(0, 300)}`);

  // object/embed/picture elements
  const objectMatches = [...html.matchAll(/<(object|embed|picture|source)[^>]*>/gi)].map((m) => m[0]);
  console.log(`\n<object/embed/picture/source> count: ${objectMatches.length}`);
  for (const tag of objectMatches.slice(0, 5)) console.log(`  ${tag.slice(0, 300)}`);

  // cellImage references in HTML
  const cellImgMatches = [...html.matchAll(/cellImage[^"'\s<>]*/gi)].map((m) => m[0]);
  console.log(`\ncellImage references in HTML: ${cellImgMatches.length}`);
  for (const ref of cellImgMatches.slice(0, 10)) console.log(`  ${ref}`);

  // GID numeric references in HTML
  for (const gid of gidSet) {
    const gidMatches = [...html.matchAll(new RegExp(gid, "g"))];
    console.log(`\nGID ${gid} occurrences in HTML: ${gidMatches.length}`);
  }

  // UUIDs
  const uuidMatches = [...html.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)];
  console.log(`\nUUID occurrences in HTML: ${uuidMatches.length}`);
  if (uuidMatches.length > 0) {
    console.log(`First 3: ${uuidMatches.slice(0, 3).map((m) => m[0]).join(", ")}`);
  }

  // Show HTML context around the first <img> tag to understand its parent structure
  const firstImgIdx = html.search(/<img[^>]*cellImage/i);
  if (firstImgIdx >= 0) {
    const start = Math.max(0, firstImgIdx - 500);
    const end = Math.min(html.length, firstImgIdx + 800);
    console.log(`\n=== HTML CONTEXT AROUND FIRST cellImage <img> (±500 chars) ===`);
    console.log(html.slice(start, end));
  }

  // Also show context around the first UUID
  const firstUuidMatch = html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (firstUuidMatch && firstUuidMatch.index !== undefined) {
    const start = Math.max(0, firstUuidMatch.index - 300);
    const end = Math.min(html.length, firstUuidMatch.index + 500);
    console.log(`\n=== HTML CONTEXT AROUND FIRST UUID ===`);
    console.log(html.slice(start, end));
  }


  process.exit(0);
}

main().catch((err) => {
  console.error("[DebugZip] Fatal:", err);
  process.exit(1);
});
