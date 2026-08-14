jest.mock("@/lib/services/system.service", () => ({
  setSyncRetired: jest.fn(),
}));
jest.mock("@/lib/services/helper.service", () => ({
  releaseSystemColProtections: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import { retireSync } from "@/lib/services/retirement.service";
import * as systemService from "@/lib/services/system.service";
import * as helper from "@/lib/services/helper.service";

const mockSystem = systemService as jest.Mocked<typeof systemService>;
const mockHelper = helper as jest.Mocked<typeof helper>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSystem.setSyncRetired.mockResolvedValue(undefined as never);
  mockHelper.releaseSystemColProtections.mockResolvedValue({
    released: 4,
  } as never);
});

describe("retireSync", () => {
  it("sets the retirement flag", async () => {
    await retireSync();

    expect(mockSystem.setSyncRetired).toHaveBeenCalled();
  });

  it("sets the flag BEFORE attempting any Sheets call", async () => {
    const order: string[] = [];
    mockSystem.setSyncRetired.mockImplementation((() => {
      order.push("flag");
      return Promise.resolve(undefined);
    }) as never);
    mockHelper.releaseSystemColProtections.mockImplementation((() => {
      order.push("sheets");
      return Promise.resolve({ released: 4 });
    }) as never);

    await retireSync();

    expect(order).toEqual(["flag", "sheets"]);
  });

  it("reports how many protections it released", async () => {
    await expect(retireSync()).resolves.toEqual({
      protectionsReleased: true,
      released: 4,
      error: null,
    });
  });

  it("still succeeds when the protection release throws", async () => {
    mockHelper.releaseSystemColProtections.mockRejectedValue(
      new Error("credentials revoked") as never,
    );

    const result = await retireSync();

    expect(result.protectionsReleased).toBe(false);
    expect(result.error).toMatch(/credentials revoked/);
  });

  it("keeps the flag set even when the Sheets call throws", async () => {
    mockHelper.releaseSystemColProtections.mockRejectedValue(
      new Error("spreadsheet deleted") as never,
    );

    await retireSync();

    // The whole point: retirement must survive already-broken Sheets access.
    expect(mockSystem.setSyncRetired).toHaveBeenCalled();
  });
});
