jest.mock("@/lib/repo/sessions.repo", () => ({
  findSessionById: jest.fn(),
  findSessionCatsWithCats: jest.fn(),
}));
jest.mock("@/lib/repo/regions.repo", () => ({
  findRegionById: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  db: { transaction: jest.fn() },
  Transaction: class {},
}));
jest.mock("@/lib/services/cats.service", () => ({
  createCat: jest.fn(),
  removeCat: jest.fn(),
}));

import { getSessionWithCats } from "@/lib/services/sessions.service";
import * as sessionsRepo from "@/lib/repo/sessions.repo";
import * as regionsRepo from "@/lib/repo/regions.repo";

const mockFindSessionById = sessionsRepo.findSessionById as jest.Mock;
const mockFindSessionCatsWithCats =
  sessionsRepo.findSessionCatsWithCats as jest.Mock;
const mockFindRegionById = regionsRepo.findRegionById as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFindSessionById.mockResolvedValue({
    id: "s1", region_id: "R-1", is_finished: false, census_no: 7,
  });
  mockFindRegionById.mockResolvedValue({ id: "R-1", name: "North Block" });
  mockFindSessionCatsWithCats.mockResolvedValue([
    { id: "c1", name: "Mango", session_cat_id: "sc1", region_name: "North Block" },
    { id: "c2", name: "Pesto", session_cat_id: "sc2", region_name: "North Block" },
  ]);
});

describe("getSessionWithCats", () => {
  it("returns null when the session does not exist", async () => {
    mockFindSessionById.mockResolvedValueOnce(undefined);
    const result = await getSessionWithCats("nope");
    expect(result).toBeNull();
    expect(mockFindSessionCatsWithCats).not.toHaveBeenCalled();
  });

  it("returns session, resolved region name, and shaped cat entries", async () => {
    const result = await getSessionWithCats("s1");
    expect(result).toEqual({
      session: { id: "s1", region_id: "R-1", is_finished: false, census_no: 7 },
      regionName: "North Block",
      cats: [
        { cat: expect.objectContaining({ id: "c1", name: "Mango" }), sessionCatId: "sc1" },
        { cat: expect.objectContaining({ id: "c2", name: "Pesto" }), sessionCatId: "sc2" },
      ],
    });
  });

  it("strips session_cat_id out of the nested cat object", async () => {
    const result = await getSessionWithCats("s1");
    expect(result?.cats[0].cat).not.toHaveProperty("session_cat_id");
  });

  it("returns null region name when the session has no region", async () => {
    mockFindSessionById.mockResolvedValueOnce({ id: "s1", region_id: null });
    mockFindSessionCatsWithCats.mockResolvedValueOnce([]);
    const result = await getSessionWithCats("s1");
    expect(result?.regionName).toBeNull();
    expect(mockFindRegionById).not.toHaveBeenCalled();
  });
});
