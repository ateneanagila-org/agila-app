import type { ReactNode } from "react";
import { MobileAppWrapper } from "@/components/mobile-shell/mobile-app-wrapper";

export default function MobileRoutesLayout({ children }: { children: ReactNode }) {
  return <MobileAppWrapper>{children}</MobileAppWrapper>;
}
