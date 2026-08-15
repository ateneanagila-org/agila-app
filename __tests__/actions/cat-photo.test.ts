// Mocks must be declared before importing the action under test.
jest.mock("drizzle-orm", () => ({ and: jest.fn(), eq: jest.fn() }));
jest.mock("@/lib/db/schema", () => ({
  cats: { id: "cats.id", photo_url: "cats.photo_url" },
  sessionCats: {},
  sessionUsers: {},
}));
jest.mock("@/lib/auth/rbac", () => ({
  requireAuth: jest
    .fn()
    .mockResolvedValue({ profile: { auth_role: "Administrator" }, user: { id: "u1" } }),
  hasRole: jest.fn().mockReturnValue(true),
  MANAGER_OR_ADMIN: ["Manager", "Administrator"],
}));
jest.mock("@/lib/services/helper.service", () => ({
  refreshCatInSyncQueue: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/repo/cats.repo", () => ({
  findCatsReferencingPhotoPaths: jest.fn().mockResolvedValue([]),
}));
jest.mock("sharp", () =>
  jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from("img")),
  })),
);
jest.mock("@/lib/supabase/admin", () => {
  const upload = jest.fn().mockResolvedValue({ error: null });
  const getPublicUrl = jest.fn(() => ({
    data: { publicUrl: "https://x.supabase.co/storage/v1/object/public/cat-photos/c1/photo.jpg" },
  }));
  const remove = jest.fn().mockResolvedValue({ error: null });
  return {
    createAdminClient: jest.fn().mockResolvedValue({
      storage: { from: jest.fn(() => ({ upload, getPublicUrl, remove })) },
    }),
    __storage: { upload, getPublicUrl, remove },
  };
});
jest.mock("@/lib/db", () => {
  const where = jest.fn().mockResolvedValue([{ id: "c1" }]);
  const set = jest.fn(() => ({ where }));
  const update = jest.fn(() => ({ set }));

  // tx.select(...).from(...).where(...).limit(1) — the pre-read removeCatPhoto
  // uses to learn the photo_url an UPDATE's .returning() couldn't give it (the
  // new, not old, values).
  const selectLimit = jest.fn().mockResolvedValue([{ photo_url: null }]);
  const selectWhere = jest.fn(() => ({ limit: selectLimit }));
  const selectFrom = jest.fn(() => ({ where: selectWhere }));
  const select = jest.fn(() => ({ from: selectFrom }));

  return {
    db: {
      update,
      transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({ update, select })),
    },
    __dbMocks: { update, set, where, select, selectFrom, selectWhere, selectLimit },
  };
});

import {
  uploadCatPhoto,
  editCatPhotoPosition,
  removeCatPhoto,
} from "@/app/actions/cat-photo";
import * as dbModule from "@/lib/db";
import * as adminModule from "@/lib/supabase/admin";
import { refreshCatInSyncQueue } from "@/lib/services/helper.service";
import { findCatsReferencingPhotoPaths } from "@/lib/repo/cats.repo";

const { set, update, selectLimit } = (dbModule as unknown as {
  __dbMocks: Record<string, jest.Mock>;
}).__dbMocks;
const transaction = (dbModule as unknown as { db: { transaction: jest.Mock } }).db.transaction;
const storage = (adminModule as unknown as { __storage: Record<string, jest.Mock> }).__storage;
const mockRefresh = refreshCatInSyncQueue as jest.Mock;
const mockFindReferencing = findCatsReferencingPhotoPaths as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  selectLimit.mockResolvedValue([{ photo_url: null }]);
  mockFindReferencing.mockResolvedValue([]);
});

describe("uploadCatPhoto", () => {
  it("stores photo_url plus the position+rotation quad and queues a sync", async () => {
    const fd = new FormData();
    fd.append("file", new File([Buffer.from("img")], "p.jpg", { type: "image/jpeg" }));
    fd.append("photo_zoom", "2.5");
    fd.append("photo_offset_x", "12");
    fd.append("photo_offset_y", "-8");
    fd.append("photo_rotation", "90");

    const res = await uploadCatPhoto("c1", fd);

    expect(storage.upload).toHaveBeenCalled();
    const payload = set.mock.calls[0][0];
    expect(payload.photo_url).toEqual(expect.stringContaining("cat-photos/c1/photo.jpg"));
    expect(payload).toMatchObject({
      photo_zoom: 2.5,
      photo_offset_x: 12,
      photo_offset_y: -8,
      photo_rotation: 90,
    });
    expect(mockRefresh).toHaveBeenCalledWith("c1", expect.anything());
    expect(res.photo_url).toEqual(expect.stringContaining("photo.jpg"));
  });

  it("clamps zoom but allows offsets beyond 100 (zoomed non-square crops)", async () => {
    const fd = new FormData();
    fd.append("file", new File([Buffer.from("img")], "p.jpg", { type: "image/jpeg" }));
    fd.append("photo_zoom", "9");
    fd.append("photo_offset_x", "250");
    fd.append("photo_offset_y", "-250");

    await uploadCatPhoto("c1", fd);

    const payload = set.mock.calls[0][0];
    expect(payload.photo_zoom).toBe(3);
    expect(payload.photo_offset_x).toBe(250);
    expect(payload.photo_offset_y).toBe(-250);
  });

  it("normalizes an invalid rotation to 0", async () => {
    const fd = new FormData();
    fd.append("file", new File([Buffer.from("img")], "p.jpg", { type: "image/jpeg" }));
    fd.append("photo_rotation", "45");

    await uploadCatPhoto("c1", fd);

    const payload = set.mock.calls[0][0];
    expect(payload.photo_rotation).toBe(0);
  });

  it("rejects a non-image file", async () => {
    const fd = new FormData();
    fd.append("file", new File([Buffer.from("x")], "p.txt", { type: "text/plain" }));
    await expect(uploadCatPhoto("c1", fd)).rejects.toThrow();
  });
});

describe("editCatPhotoPosition", () => {
  it("updates only the position+rotation columns — no photo_url, no sync, no transaction", async () => {
    await editCatPhotoPosition("c1", { zoom: 2, offsetX: 10, offsetY: -5, rotation: 90 });

    expect(update).toHaveBeenCalledTimes(1);
    const payload = set.mock.calls[0][0];
    expect(payload).toEqual({
      photo_zoom: 2,
      photo_offset_x: 10,
      photo_offset_y: -5,
      photo_rotation: 90,
    });
    expect(payload).not.toHaveProperty("photo_url");
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("normalizes an invalid rotation to 0", async () => {
    await editCatPhotoPosition("c1", { zoom: 2, offsetX: 10, offsetY: -5, rotation: 45 });

    const payload = set.mock.calls[0][0];
    expect(payload.photo_rotation).toBe(0);
  });
});

describe("removeCatPhoto", () => {
  it("clears photo_url, resets position+rotation to identity, queues a sync, and deletes the now-unreferenced blob", async () => {
    selectLimit.mockResolvedValue([
      { photo_url: "https://x.supabase.co/storage/v1/object/public/cat-photos/c1/photo.jpg" },
    ]);
    mockFindReferencing.mockResolvedValue([]);

    await removeCatPhoto("c1");

    const payload = set.mock.calls[0][0];
    expect(payload).toMatchObject({
      photo_url: null,
      photo_zoom: 1,
      photo_offset_x: 0,
      photo_offset_y: 0,
      photo_rotation: 0,
    });
    expect(mockRefresh).toHaveBeenCalledWith("c1", expect.anything());

    // Reference check runs against the path derived from the pre-cleared
    // photo_url, not the cat id.
    expect(mockFindReferencing).toHaveBeenCalledWith(["c1/photo.jpg"]);
    expect(storage.remove).toHaveBeenCalledWith(["c1/photo.jpg"]);
  });

  it("does not delete the storage object when another cat still references it", async () => {
    selectLimit.mockResolvedValue([
      { photo_url: "https://x.supabase.co/storage/v1/object/public/cat-photos/c1/photo.jpg" },
    ]);
    mockFindReferencing.mockResolvedValue([
      { photo_url: "https://x.supabase.co/storage/v1/object/public/cat-photos/c1/photo.jpg" },
    ]);

    await removeCatPhoto("c1");

    expect(mockFindReferencing).toHaveBeenCalledWith(["c1/photo.jpg"]);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("skips storage cleanup entirely when the cat had no photo", async () => {
    selectLimit.mockResolvedValue([{ photo_url: null }]);

    await removeCatPhoto("c1");

    expect(mockFindReferencing).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
