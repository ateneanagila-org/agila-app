jest.mock("@/lib/db", () => {
  const findFirst = jest.fn();
  return {
    db: { query: { sessions: { findFirst } } },
    DB: class {},
  };
});

import { findLatestSessionDateForCat } from "@/lib/repo/sessions.repo";
import { db } from "@/lib/db";

const findFirst = (db as unknown as {
  query: { sessions: { findFirst: jest.Mock } };
}).query.sessions.findFirst;

beforeEach(() => findFirst.mockReset());

describe("findLatestSessionDateForCat", () => {
  it("returns the latest session's created_at", async () => {
    const d = new Date(2025, 7, 18);
    findFirst.mockResolvedValue({ created_at: d });
    await expect(findLatestSessionDateForCat("cat-1")).resolves.toBe(d);
  });

  it("returns null when the cat has no census session", async () => {
    findFirst.mockResolvedValue(undefined);
    await expect(findLatestSessionDateForCat("cat-1")).resolves.toBeNull();
  });
});
