// Regression guard for the storage GC scan.
//
// listAllPhotoPaths used to call the Supabase Storage API once per object
// prefix: 1 list for the bucket root, then N more, one per cat. Against live
// data that measured 502 sequential round-trips and ~81 seconds — fine on a
// developer machine with no execution limit, fatal on Vercel, where the
// function is killed long before it finishes. Reclaim orphaned photos worked
// locally and silently failed in production for exactly this reason.
//
// No test caught it because the storage seam is mocked everywhere, so the call
// COUNT was invisible. These tests pin the structural property that matters:
// the scan issues one query regardless of colony size, and never walks prefixes.

jest.mock("@/lib/repo/storage.repo", () => ({
  findAllPhotoObjectPaths: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

import { listAllPhotoPaths } from "@/lib/services/cat-photo-storage";
import * as storageRepo from "@/lib/repo/storage.repo";
import { createAdminClient } from "@/lib/supabase/admin";

const mockFindAll = storageRepo.findAllPhotoObjectPaths as jest.Mock;
const mockAdminClient = createAdminClient as jest.Mock;

describe("listAllPhotoPaths", () => {
  it("returns every object path in the bucket", async () => {
    mockFindAll.mockResolvedValue(["a/photo.jpg", "b/photo.jpg"]);

    await expect(listAllPhotoPaths()).resolves.toEqual([
      "a/photo.jpg",
      "b/photo.jpg",
    ]);
  });

  it("scans with ONE query, never one call per prefix", async () => {
    // 600 cats — comfortably past the point where per-prefix listing blew the
    // serverless execution budget.
    const many = Array.from({ length: 600 }, (_, i) => `cat-${i}/photo.jpg`);
    mockFindAll.mockResolvedValue(many);

    const paths = await listAllPhotoPaths();

    expect(paths).toHaveLength(600);
    // The whole point: cost is independent of how many cats exist.
    expect(mockFindAll).toHaveBeenCalledTimes(1);
    // And the Storage API — the source of the N+1 — is not touched at all.
    expect(mockAdminClient).not.toHaveBeenCalled();
  });

  it("survives an empty bucket", async () => {
    mockFindAll.mockResolvedValue([]);

    await expect(listAllPhotoPaths()).resolves.toEqual([]);
    expect(mockAdminClient).not.toHaveBeenCalled();
  });
});
