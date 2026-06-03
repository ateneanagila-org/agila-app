jest.mock("@/lib/repo/cats.repo", () => ({
  insertCat: jest.fn(),
  insertCatHealthRecord: jest.fn(),
  updateCat: jest.fn(),
  updateCatHealthRecord: jest.fn(),
  deleteCat: jest.fn(),
}));
jest.mock("@/lib/repo/sessions.repo", () => ({ resolveCatRegion: jest.fn() }));
jest.mock("@/lib/services/helper.service", () => ({ refreshCatInSyncQueue: jest.fn() }));
jest.mock("@/lib/services/system-session.service", () => ({ linkCatToSystemSession: jest.fn() }));
jest.mock("@/lib/db", () => {
  const tx = {
    insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })) })),
  };
  return {
    db: { transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)), __tx: tx },
    Transaction: class {},
  };
});

import { editCat, removeCat } from "@/lib/services/cats.service";
import * as catsRepo from "@/lib/repo/cats.repo";
import * as sessionsRepo from "@/lib/repo/sessions.repo";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import { db } from "@/lib/db";

const mockCats = catsRepo as jest.Mocked<typeof catsRepo>;
const resolveRegion = sessionsRepo.resolveCatRegion as jest.Mock;
const refreshQueue = refreshCatInSyncQueue as jest.Mock;
const tx = (db as unknown as { __tx: { insert: jest.Mock; update: jest.Mock } }).__tx;

beforeEach(() => {
  jest.clearAllMocks();
  mockCats.updateCat.mockResolvedValue([{ id: "c1" }] as never);
  mockCats.updateCatHealthRecord.mockResolvedValue(undefined as never);
});

const baseEdit = { id: "c1", region_id: "R-NEW" } as never;

describe("editCat move-cleanup", () => {
  it("region changed: cancels old-region pending tasks and queues DELETE to old region", async () => {
    resolveRegion.mockResolvedValueOnce({ id: "R-OLD", name: "Old" }); // pre-update
    refreshQueue.mockResolvedValueOnce({ id: "R-NEW", name: "New" });  // new region

    await editCat(baseEdit);

    // tx.update used to cancel old PENDING tasks
    expect(tx.update).toHaveBeenCalledTimes(1);
    // tx.insert used to queue the DELETE
    expect(tx.insert).toHaveBeenCalledTimes(1);
    const valuesFn = tx.insert.mock.results[0].value.values as jest.Mock;
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entityId: "c1", regionId: "R-OLD" }),
    );
  });

  it("region unchanged: no DELETE queued, no cancellation", async () => {
    resolveRegion.mockResolvedValueOnce({ id: "R-NEW", name: "New" }); // pre-update
    refreshQueue.mockResolvedValueOnce({ id: "R-NEW", name: "New" });  // new region

    await editCat(baseEdit);

    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("override cleared to nowhere (new region null): cancels old tasks and queues DELETE", async () => {
    resolveRegion.mockResolvedValueOnce({ id: "R-OLD", name: "Old" }); // pre-update
    refreshQueue.mockResolvedValueOnce(undefined);                     // resolves to nothing

    await editCat(baseEdit);

    expect(tx.update).toHaveBeenCalledTimes(1);
    const valuesFn = tx.insert.mock.results[0].value.values as jest.Mock;
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE", entityId: "c1", regionId: "R-OLD" }),
    );
  });
});
