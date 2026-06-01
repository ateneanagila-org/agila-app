import type { ReactNode } from "react";
import { CatDetailProvider } from "@/contexts/cat-detail-context";

export default function DatabaseLayout({ children }: { children: ReactNode }) {
  return <CatDetailProvider>{children}</CatDetailProvider>;
}
