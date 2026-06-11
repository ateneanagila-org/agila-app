import type { Metadata } from "next";
import { SessionsCreateScreen } from "@/components/app-pages/sessions/sessions-create-screen";
import { getSessionWithCats } from "@/lib/services/sessions.service";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = { title: "Sessions — Create" };

export default async function SessionsCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { sessionId } = await searchParams;

  const initialData = sessionId
    ? await loadData(
        "Create session initial load",
        () => getSessionWithCats(sessionId),
        null,
      )
    : null;

  return (
    <SessionsCreateScreen
      sessionId={sessionId ?? null}
      initialData={initialData}
    />
  );
}
