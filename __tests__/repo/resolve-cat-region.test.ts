jest.mock("@/lib/db", () => ({ db: {}, Transaction: class {} }));

import { resolveCatRegion } from "@/lib/repo/sessions.repo";

// A fake drizzle client. findFirst fakes ignore their where/with builders and
// just return the queued value, so the predicate closures never execute.
function makeClient(opts: {
  cat?: { region_id: string | null } | undefined;
  region?: { id: string; name: string } | undefined;
  session?: { region: { id: string; name: string } } | undefined;
}) {
  return {
    query: {
      cats: { findFirst: jest.fn().mockResolvedValue(opts.cat) },
      regions: { findFirst: jest.fn().mockResolvedValue(opts.region) },
      sessions: { findFirst: jest.fn().mockResolvedValue(opts.session) },
    },
  } as never;
}

describe("resolveCatRegion", () => {
  it("override set: returns the override region, never reads sessions", async () => {
    const client = makeClient({
      cat: { region_id: "R-OVERRIDE" },
      region: { id: "R-OVERRIDE", name: "Override" },
      session: { region: { id: "R-SESSION", name: "Session" } },
    });
    const region = await resolveCatRegion("c1", client);
    expect(region).toEqual({ id: "R-OVERRIDE", name: "Override" });
    expect((client as never as { query: { sessions: { findFirst: jest.Mock } } }).query.sessions.findFirst)
      .not.toHaveBeenCalled();
  });

  it("override null: falls back to the latest session's region", async () => {
    const client = makeClient({
      cat: { region_id: null },
      session: { region: { id: "R-SESSION", name: "Session" } },
    });
    const region = await resolveCatRegion("c1", client);
    expect(region).toEqual({ id: "R-SESSION", name: "Session" });
  });

  it("no override and no sessions: returns undefined", async () => {
    const client = makeClient({ cat: { region_id: null }, session: undefined });
    const region = await resolveCatRegion("c1", client);
    expect(region).toBeUndefined();
  });
});
