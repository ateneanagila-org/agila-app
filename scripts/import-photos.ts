import "dotenv/config";
import { bulkImportAllNullPhotos } from "@/lib/services/photo-import.service";

async function main() {
  console.log("[ImportPhotos] Starting bulk backfill...");
  const result = await bulkImportAllNullPhotos();
  console.log("[ImportPhotos] Done:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("[ImportPhotos] Fatal:", err);
  process.exit(1);
});
