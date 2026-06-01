import type { Metadata } from "next";
import { OverviewScreen } from "@/components/app-pages/overview/overview-screen";

export const metadata: Metadata = {
  title: "Overview",
};

export default function OverviewPage() {
  return <OverviewScreen />;
}
