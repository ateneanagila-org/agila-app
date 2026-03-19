import type { Metadata } from "next";
import { TnvrScreen } from "@/components/app-pages/tnvr/tnvr-screen";

export const metadata: Metadata = {
  title: "TNVR",
};

export default function TnvrPage() {
  return <TnvrScreen />;
}
