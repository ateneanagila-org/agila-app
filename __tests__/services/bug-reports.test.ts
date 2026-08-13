jest.mock("@/lib/repo/bug-reports.repo", () => ({
  findBugReports: jest.fn(),
  countOpenBugReports: jest.fn(),
  insertBugReport: jest.fn(),
  updateBugReport: jest.fn(),
  deleteBugReport: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import {
  createBugReport,
  setBugReportStatus,
  removeBugReport,
} from "@/lib/services/bug-reports.service";
import * as repo from "@/lib/repo/bug-reports.repo";

const mockRepo = repo as jest.Mocked<typeof repo>;

const REPORTER = {
  id: "u1",
  name: "Ada Reyes",
  email: "ada@example.com",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.insertBugReport.mockResolvedValue([{ id: "b1" }] as never);
  mockRepo.updateBugReport.mockResolvedValue([{ id: "b1" }] as never);
  mockRepo.deleteBugReport.mockResolvedValue([{ id: "b1" }] as never);
});

describe("createBugReport", () => {
  it("snapshots the reporter's name and email at write time", async () => {
    await createBugReport({ message: "Photos fail to upload", reporter: REPORTER });

    expect(mockRepo.insertBugReport).toHaveBeenCalledWith({
      message: "Photos fail to upload",
      reporter_id: "u1",
      reporter_name: "Ada Reyes",
      reporter_email: "ada@example.com",
    });
  });

  it("trims the message", async () => {
    await createBugReport({ message: "  spacey  ", reporter: REPORTER });

    expect(mockRepo.insertBugReport).toHaveBeenCalledWith(
      expect.objectContaining({ message: "spacey" }),
    );
  });

  it("tolerates a reporter with no profile name", async () => {
    await createBugReport({
      message: "x",
      reporter: { ...REPORTER, name: null },
    });

    expect(mockRepo.insertBugReport).toHaveBeenCalledWith(
      expect.objectContaining({ reporter_name: null }),
    );
  });

  it("rejects an empty message without touching the repo", async () => {
    await expect(
      createBugReport({ message: "   ", reporter: REPORTER }),
    ).rejects.toThrow(/empty/i);
    expect(mockRepo.insertBugReport).not.toHaveBeenCalled();
  });
});

describe("setBugReportStatus", () => {
  it("stamps resolved_at when resolving", async () => {
    await setBugReportStatus("b1", "Resolved");

    const [id, data] = mockRepo.updateBugReport.mock.calls[0];
    expect(id).toBe("b1");
    expect(data.status).toBe("Resolved");
    expect(data.resolved_at).toBeInstanceOf(Date);
  });

  it("clears resolved_at when reopening", async () => {
    await setBugReportStatus("b1", "Open");

    expect(mockRepo.updateBugReport).toHaveBeenCalledWith("b1", {
      status: "Open",
      resolved_at: null,
    });
  });

  it("throws when the report does not exist", async () => {
    mockRepo.updateBugReport.mockResolvedValue([] as never);

    await expect(setBugReportStatus("nope", "Resolved")).rejects.toThrow(
      /not found/i,
    );
  });
});

describe("removeBugReport", () => {
  it("throws when the report does not exist", async () => {
    mockRepo.deleteBugReport.mockResolvedValue([] as never);

    await expect(removeBugReport("nope")).rejects.toThrow(/not found/i);
  });
});
