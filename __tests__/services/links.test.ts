jest.mock("@/lib/repo/system.repo", () => ({
  findSystemConfig: jest.fn(),
  upsertSystemConfig: jest.fn(),
  deleteSystemConfigKey: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import { getLinks, updateLinks } from "@/lib/services/system.service";
import * as systemRepo from "@/lib/repo/system.repo";
import { DEFAULT_LINKS } from "@/lib/constants";
import { updateLinksSchema } from "@/lib/validation/system";

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

describe("updateLinks", () => {
  beforeEach(() => {
    mockRepo.findSystemConfig.mockResolvedValue([] as never);
  });

  it("upserts a provided URL", async () => {
    await updateLinks({ censusReport: "https://example.com/a" });

    expect(mockRepo.upsertSystemConfig).toHaveBeenCalledWith(
      "link_census_report",
      "https://example.com/a",
    );
    expect(mockRepo.deleteSystemConfigKey).not.toHaveBeenCalled();
  });

  it("deletes the row when a field is cleared, restoring the default", async () => {
    await updateLinks({ censusReport: null });

    expect(mockRepo.deleteSystemConfigKey).toHaveBeenCalledWith(
      "link_census_report",
    );
    expect(mockRepo.upsertSystemConfig).not.toHaveBeenCalled();
  });

  it("leaves untouched fields alone", async () => {
    await updateLinks({ adoptFoster: "https://example.com/form" });

    expect(mockRepo.upsertSystemConfig).toHaveBeenCalledTimes(1);
    expect(mockRepo.upsertSystemConfig).toHaveBeenCalledWith(
      "link_adopt_foster",
      "https://example.com/form",
    );
    expect(mockRepo.deleteSystemConfigKey).not.toHaveBeenCalled();
  });

  it("returns the freshly resolved links", async () => {
    mockRepo.findSystemConfig.mockResolvedValue([
      { key: "link_census_report", value: "https://example.com/a" },
    ] as never);

    const links = await updateLinks({ censusReport: "https://example.com/a" });

    expect(links.censusReport).toBe("https://example.com/a");
  });
});

describe("updateLinksSchema", () => {
  it("rejects a value that is not a URL", () => {
    expect(
      updateLinksSchema.safeParse({ censusReport: "not a url" }).success,
    ).toBe(false);
  });

  it("rejects a non-https URL", () => {
    expect(
      updateLinksSchema.safeParse({ censusReport: "http://example.com" })
        .success,
    ).toBe(false);
  });

  it("accepts null as an explicit clear", () => {
    expect(updateLinksSchema.safeParse({ censusReport: null }).success).toBe(
      true,
    );
  });

  it("rejects an empty payload", () => {
    expect(updateLinksSchema.safeParse({}).success).toBe(false);
  });
});
