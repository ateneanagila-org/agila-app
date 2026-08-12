jest.mock("@/lib/repo/system.repo", () => ({
  findSystemConfig: jest.fn(),
  upsertSystemConfig: jest.fn(),
  deleteSystemConfigKey: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import { getLinks } from "@/lib/services/system.service";
import * as systemRepo from "@/lib/repo/system.repo";
import { DEFAULT_LINKS } from "@/lib/constants";

const mockRepo = systemRepo as jest.Mocked<typeof systemRepo>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getLinks", () => {
  it("falls back to the compiled-in constant when no row exists", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([] as never);

    await expect(getLinks()).resolves.toEqual(DEFAULT_LINKS);
  });

  it("lets a DB value override the constant", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([
      { key: "link_census_report", value: "https://example.com/census" },
    ] as never);

    const links = await getLinks();

    expect(links.censusReport).toBe("https://example.com/census");
    // Unset keys still fall back.
    expect(links.referralSheet).toBe(DEFAULT_LINKS.referralSheet);
    expect(links.adoptFoster).toBe(DEFAULT_LINKS.adoptFoster);
  });

  it("ignores unrelated config keys", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([
      { key: "sync_frozen", value: "true" },
    ] as never);

    await expect(getLinks()).resolves.toEqual(DEFAULT_LINKS);
  });

  it("treats a blank stored value as unset", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([
      { key: "link_adopt_foster", value: "   " },
    ] as never);

    await expect(getLinks()).resolves.toEqual(DEFAULT_LINKS);
  });

  it("degrades to defaults when the read throws", async () => {
    mockRepo.findSystemConfig.mockRejectedValue(new Error("db down") as never);

    await expect(getLinks()).resolves.toEqual(DEFAULT_LINKS);
  });
});
