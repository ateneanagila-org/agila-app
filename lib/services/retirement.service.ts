import { setSyncRetired } from "@/lib/services/system.service";
import { releaseSystemColProtections } from "@/lib/services/helper.service";

/**
 * Permanently retires the Google Sheets sync.
 *
 * Lives in its own module rather than system.service.ts on purpose:
 * helper.service.ts imports from system.service.ts, so importing
 * releaseSystemColProtections there would create a runtime import cycle.
 *
 * Note this module never names the system_config key — setSyncRetired owns it.
 * Spelling it here too would risk a silent typo: the write would land under a
 * misspelled key and isSyncRetired would keep returning false.
 *
 * The flag is written FIRST and the Sheets call is best-effort. A decade from
 * now the likeliest reason to reach for this button is that Google access has
 * already broken — a killswitch that cannot fire when the thing it kills is
 * already broken would be useless.
 */
export async function retireSync(): Promise<{
  protectionsReleased: boolean;
  released: number;
  error: string | null;
}> {
  await setSyncRetired();

  try {
    const { released } = await releaseSystemColProtections();
    return { protectionsReleased: true, released, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Sheets error";
    console.error("[RetireSync] Protection release failed:", message);
    return { protectionsReleased: false, released: 0, error: message };
  }
}
