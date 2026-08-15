import { monthsSince, formatMonthsAgo } from "@/lib/utils";

const NOW = new Date(2026, 7, 15);

describe("monthsSince", () => {
  it("counts whole elapsed months", () => {
    expect(monthsSince(new Date(2026, 5, 15), NOW)).toBe(2);
    expect(monthsSince(new Date(2025, 5, 15), NOW)).toBe(14);
  });

  it("does not count a month until the day-of-month is reached", () => {
    expect(monthsSince(new Date(2026, 6, 20), NOW)).toBe(0);
    expect(monthsSince(new Date(2026, 6, 15), NOW)).toBe(1);
  });

  it("never returns a negative count for a future date", () => {
    expect(monthsSince(new Date(2027, 0, 15), NOW)).toBe(0);
  });

  it("is calendar-aware, not millisecond division", () => {
    // Feb is short; ms-division would under-count this as 0.
    expect(monthsSince(new Date(2026, 0, 31), new Date(2026, 2, 1))).toBe(1);
  });
});

describe("formatMonthsAgo", () => {
  it("is singular at one month", () => {
    expect(formatMonthsAgo(new Date(2026, 6, 15), NOW)).toBe(
      "1 month ago",
    );
  });

  it("is plural beyond one month", () => {
    expect(formatMonthsAgo(new Date(2025, 5, 15), NOW)).toBe(
      "14 months ago",
    );
  });

  it("reads as this month when under a month old", () => {
    expect(formatMonthsAgo(new Date(2026, 7, 1), NOW)).toBe(
      "this month",
    );
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(formatMonthsAgo("2026-07-15T00:00:00", NOW)).toBe("1 month ago");
  });

  it("returns Unknown for an unparseable date", () => {
    expect(formatMonthsAgo("not-a-date", NOW)).toBe("Unknown");
  });
});
