import type { Metadata } from "next";
import {
  SessionsManagerScreen,
  type ReviewItem,
} from "@/components/app-pages/sessions/sessions-manager-screen";
import { findCats } from "@/lib/repo/cats.repo";
import { findSessionCats } from "@/lib/repo/sessions.repo";
import type { SelectSessionCat } from "@/lib/validation/sessions";
import { loadData } from "@/lib/safe-initial-data";

export const metadata: Metadata = { title: "Sessions — Manager" };

export default async function SessionsManagerPage() {
  const [cats, sessionCats] = await Promise.all([
    loadData(
      "Sessions manager cats initial load",
      () => findCats({ entry_status: "Unreviewed" }),
      [],
    ),
    loadData(
      "Sessions manager session cats initial load",
      () => findSessionCats({}),
      [],
    ),
  ]);
  const sessionCatByCatId = new Map<string, SelectSessionCat>();

  for (const sessionCat of sessionCats) {
    sessionCatByCatId.set(sessionCat.cat_id, sessionCat);
  }

  const initialForReview: ReviewItem[] = cats
    .map((cat) => {
      const sessionCat = sessionCatByCatId.get(cat.id);
      if (!sessionCat) return null;
      return {
        cat,
        sessionId: sessionCat.session_id,
        sessionCatId: sessionCat.id,
      };
    })
    .filter((item): item is ReviewItem => item !== null);

  return <SessionsManagerScreen initialForReview={initialForReview} />;
}
