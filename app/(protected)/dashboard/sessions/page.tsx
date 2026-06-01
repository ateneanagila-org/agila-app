import type { Metadata } from "next";
import { SessionsScreen } from "@/components/app-pages/sessions/sessions-screen";
import { findCats } from "@/lib/repo/cats.repo";
import { findRegions } from "@/lib/repo/regions.repo";
import {
  findSessionCats,
  findSessions,
  findSessionUsers,
} from "@/lib/repo/sessions.repo";
import { getCurrentUser } from "@/lib/auth/rbac";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = {
  title: "Sessions",
};

type SessionStatus = "Unfinished" | "Submitted" | "Reviewed";

export default async function SessionsPage() {
  const current = await loadData(
    "Sessions current user initial load",
    () => getCurrentUser(),
    null,
  );
  if (!current) {
    return (
      <SessionsScreen
        initialSessions={[]}
        initialAllSessions={[]}
        initialStatusBySession={{}}
        initialRegionOptions={[]}
      />
    );
  }

  const [regions, sessionUsers, allSessions, sessionCats, unreviewedCats] =
    await Promise.all([
      loadData("Sessions regions initial load", () => findRegions(), []),
      loadData(
        "Sessions users initial load",
        () => findSessionUsers({ user_id: current.user.id }),
        [],
      ),
      loadData("Sessions initial load", () => findSessions({}), []),
      loadData("Session cats initial load", () => findSessionCats({}), []),
      loadData(
        "Sessions unreviewed cats initial load",
        () => findCats({ entry_status: "Unreviewed" }),
        [],
      ),
    ]);

  const mySessionIds = new Set(
    sessionUsers.map((sessionUser) => sessionUser.session_id),
  );
  const sessions = allSessions.filter((session) => mySessionIds.has(session.id));
  const unreviewedCatIds = new Set(
    unreviewedCats.map((cat) => cat.id),
  );
  const catIdsBySession = new Map<string, string[]>();

  for (const sessionCat of sessionCats) {
    const ids = catIdsBySession.get(sessionCat.session_id) ?? [];
    ids.push(sessionCat.cat_id);
    catIdsBySession.set(sessionCat.session_id, ids);
  }

  const statusBySession: Record<string, SessionStatus> = {};
  for (const session of sessions) {
    const catIds = catIdsBySession.get(session.id) ?? [];
    if (!session.is_finished) {
      statusBySession[session.id] = "Unfinished";
      continue;
    }
    statusBySession[session.id] = catIds.some((id) => unreviewedCatIds.has(id))
      ? "Submitted"
      : "Reviewed";
  }

  return (
    <SessionsScreen
      initialSessions={sessions}
      initialAllSessions={allSessions}
      initialStatusBySession={statusBySession}
      initialRegionOptions={regions}
    />
  );
}
