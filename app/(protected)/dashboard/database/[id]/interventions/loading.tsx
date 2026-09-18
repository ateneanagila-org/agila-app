import { TabBodySkeleton } from "@/components/app-pages/database/tab-body-skeleton";

/**
 * Scoped to the tab body. The identity card and the tab bar live in the [id]
 * layout, above this boundary, so switching tabs no longer blanks them.
 */
export default function InterventionsLoading() {
  return <TabBodySkeleton rows={4} />;
}
