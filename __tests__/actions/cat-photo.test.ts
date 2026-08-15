// Mocks must be declared before importing the action under test.
jest.mock("drizzle-orm", () => ({ and: jest.fn(), eq: jest.fn() }));
jest.mock("@/lib/db/schema", () => ({
  cats: { id: "cats.id" },
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
  return {
    db: {
      update,
      transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({ update })),
    },
    __dbMocks: { update, set, where },
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

const { set, update } = (dbModule as unknown as { __dbMocks: Record<string, jest.Mock> }).__dbMocks;
const transaction = (dbModule as unknown as { db: { transaction: jest.Mock } }).db.transaction;
const storage = (adminModule as unknown as { __storage: Record<string, jest.Mock> }).__storage;
const mockRefresh = refreshCatInSyncQueue as jest.Mock;

beforeEach(() => jest.clearAllMocks());

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
  it("clears photo_url, resets position+rotation to identity, and queues a sync", async () => {
    await removeCatPhoto("c1");

    expect(storage.remove).toHaveBeenCalled();
    const payload = set.mock.calls[0][0];
    expect(payload).toMatchObject({
      photo_url: null,
      photo_zoom: 1,
      photo_offset_x: 0,
      photo_offset_y: 0,
      photo_rotation: 0,
    });
    expect(mockRefresh).toHaveBeenCalledWith("c1", expect.anything());
  });
});
