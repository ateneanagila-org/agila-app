import type { Metadata } from "next";
import { SessionsScreen } from "@/components/app-pages/sessions/sessions-screen";
import { findRegions } from "@/lib/repo/regions.repo";
import { findSessions, findSessionUsers } from "@/lib/repo/sessions.repo";
import { getCurrentUser } from "@/lib/auth/rbac";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = {
  title: "Sessions",
};

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
        initialRegionOptions={[]}
      />
    );
  }

  const [regions, sessionUsers, allSessions] = await Promise.all([
    loadData("Sessions regions initial load", () => findRegions(), []),
    loadData(
      "Sessions users initial load",
      () => findSessionUsers({ user_id: current.user.id }),
      [],
    ),
    loadData("Sessions initial load", () => findSessions({}), []),
  ]);

  const mySessionIds = new Set(
    sessionUsers.map((sessionUser) => sessionUser.session_id),
  );
  const sessions = allSessions.filter((session) => mySessionIds.has(session.id));

  return (
    <SessionsScreen
      initialSessions={sessions}
      initialAllSessions={allSessions}
      initialRegionOptions={regions}
    />
  );
}
