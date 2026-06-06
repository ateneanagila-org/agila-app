jest.mock("@/lib/repo/sessions.repo", () => ({
  insertSession: jest.fn(),
  insertSessionUser: jest.fn(),
  insertSessionCat: jest.fn(),
  deleteSession: jest.fn(),
  deleteSessionCat: jest.fn(),
  findOrphanCatsForSessionDelete: jest.fn(),
  findOrphanCatForSessionCatDelete: jest.fn(),
}));
jest.mock("@/lib/services/cats.service", () => ({
  createCat: jest.fn(),
  removeCat: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: { transaction: jest.fn() },
  Transaction: class {},
}));

import {
  createSession,
  finishSession,
  createSessionCat,
  discardSession,
  removeSessionCat,
} from "@/lib/services/sessions.service";
import * as sessionsRepo from "@/lib/repo/sessions.repo";
import { createCat, removeCat } from "@/lib/services/cats.service";
import { db } from "@/lib/db";

const mockInsertSession = sessionsRepo.insertSession as jest.Mock;
const mockInsertSessionUser = sessionsRepo.insertSessionUser as jest.Mock;
const mockInsertSessionCat = sessionsRepo.insertSessionCat as jest.Mock;
const mockDeleteSession = sessionsRepo.deleteSession as jest.Mock;
const mockDeleteSessionCat = sessionsRepo.deleteSessionCat as jest.Mock;
const mockFindOrphansForSession = sessionsRepo.findOrphanCatsForSessionDelete as jest.Mock;
const mockFindOrphanForSessionCat = sessionsRepo.findOrphanCatForSessionCatDelete as jest.Mock;
const mockCreateCat = createCat as jest.Mock;
const mockRemoveCat = removeCat as jest.Mock;
const dbTransaction = db.transaction as jest.Mock;

// Builds a fake drizzle tx for finishSession.
// update is called twice: first on sessions (needs .returning()), then on cats (just awaited).
// select is called once to fetch linked cat IDs.
function makeFinishTx(opts: { sessionRow?: object; catIdRows?: Array<{ cat_id: string }> } = {}) {
  const { sessionRow = { id: "s1" }, catIdRows = [] } = opts;

  const returningFn = jest.fn().mockResolvedValue([sessionRow]);
  const sessionWhere = jest.fn().mockReturnValue({ returning: returningFn });
  const catsWhere = jest.fn().mockResolvedValue(undefined);

  const update = jest.fn()
    .mockImplementationOnce(() => ({ set: jest.fn(() => ({ where: sessionWhere })) }))
    .mockImplementationOnce(() => ({ set: jest.fn(() => ({ where: catsWhere })) }));

  const selectWhere = jest.fn().mockResolvedValue(catIdRows);
  const select = jest.fn(() => ({ from: jest.fn(() => ({ where: selectWhere })) }));

  return { update, select, _sessionWhere: sessionWhere, _catsWhere: catsWhere };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertSession.mockResolvedValue([{ id: "s1", region_id: "R-1" }]);
  mockInsertSessionUser.mockResolvedValue(undefined);
  mockInsertSessionCat.mockResolvedValue(undefined);
  mockCreateCat.mockResolvedValue({ id: "c1", name: "Pesto" });
  mockDeleteSession.mockResolvedValue(undefined);
  mockDeleteSessionCat.mockResolvedValue(undefined);
  mockFindOrphansForSession.mockResolvedValue([]);
  mockFindOrphanForSessionCat.mockResolvedValue([]);
  mockRemoveCat.mockResolvedValue({ success: true });
});

describe("createSession", () => {
  beforeEach(() => {
    dbTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));
  });

  it("returns the new session", async () => {
    const result = await createSession({ region_id: "R-1", user_id: "u1" } as never);
    expect(result).toEqual({ id: "s1", region_id: "R-1" });
  });

  it("links the user to the session", async () => {
    await createSession({ region_id: "R-1", user_id: "u1" } as never);
    expect(mockInsertSessionUser).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s1", user_id: "u1" }),
      expect.anything(),
    );
  });
});

describe("finishSession", () => {
  it("returns the updated session row", async () => {
    const tx = makeFinishTx({ sessionRow: { id: "s1", is_finished: true } });
    dbTransaction.mockImplementationOnce(async (cb: (tx: unknown) => unknown) => cb(tx));

    const result = await finishSession("s1");
    expect(result).toEqual({ id: "s1", is_finished: true });
  });

  it("with linked cats: runs the cats status update", async () => {
    const tx = makeFinishTx({ catIdRows: [{ cat_id: "c1" }, { cat_id: "c2" }] });
    dbTransaction.mockImplementationOnce(async (cb: (tx: unknown) => unknown) => cb(tx));

    await finishSession("s1");

    // update called twice: sessions mark-finished + cats flip-to-Unreviewed
    expect(tx.update).toHaveBeenCalledTimes(2);
  });

  it("with no linked cats: skips the cats status update", async () => {
    const tx = makeFinishTx({ catIdRows: [] });
    dbTransaction.mockImplementationOnce(async (cb: (tx: unknown) => unknown) => cb(tx));

    await finishSession("s1");

    // update called once: only sessions mark-finished
    expect(tx.update).toHaveBeenCalledTimes(1);
  });
});

describe("createSessionCat", () => {
  beforeEach(() => {
    dbTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));
  });

  it("returns the newly created cat", async () => {
    const result = await createSessionCat({ session_id: "s1", name: "Mango" } as never);
    expect(result).toEqual({ id: "c1", name: "Pesto" });
  });

  it("links the cat to the session", async () => {
    await createSessionCat({ session_id: "s1", name: "Mango" } as never);
    expect(mockInsertSessionCat).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s1", cat_id: "c1" }),
      expect.anything(),
    );
  });
});

describe("discardSession", () => {
  beforeEach(() => {
    dbTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));
  });

  it("hard-deletes each orphaned draft via removeCat, then deletes the session", async () => {
    mockFindOrphansForSession.mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }]);

    const result = await discardSession("s1");

    expect(mockRemoveCat).toHaveBeenCalledTimes(2);
    expect(mockRemoveCat).toHaveBeenCalledWith({ id: "c1" });
    expect(mockRemoveCat).toHaveBeenCalledWith({ id: "c2" });
    expect(mockDeleteSession).toHaveBeenCalledWith("s1");
    expect(result).toEqual({ success: true, deletedCats: 2 });
  });

  it("no orphans: deletes only the session, removeCat untouched", async () => {
    mockFindOrphansForSession.mockResolvedValueOnce([]);

    const result = await discardSession("s1");

    expect(mockRemoveCat).not.toHaveBeenCalled();
    expect(mockDeleteSession).toHaveBeenCalledWith("s1");
    expect(result).toEqual({ success: true, deletedCats: 0 });
  });
});

describe("removeSessionCat", () => {
  it("orphaned cat: removeCat (cascades the join), no separate join delete", async () => {
    mockFindOrphanForSessionCat.mockResolvedValueOnce([{ id: "c1" }]);

    const result = await removeSessionCat("sc1");

    expect(mockRemoveCat).toHaveBeenCalledWith({ id: "c1" });
    expect(mockDeleteSessionCat).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, deletedCats: 1 });
  });

  it("non-orphan cat: drops only the join row, cat survives", async () => {
    mockFindOrphanForSessionCat.mockResolvedValueOnce([]);

    const result = await removeSessionCat("sc1");

    expect(mockRemoveCat).not.toHaveBeenCalled();
    expect(mockDeleteSessionCat).toHaveBeenCalledWith("sc1");
    expect(result).toEqual({ success: true, deletedCats: 0 });
  });
});
