import type { Metadata } from "next";

export const maxDuration = 120;
import { UsersScreen } from "@/components/app-pages/users/users-screen";

export const metadata: Metadata = {
  title: "User Control",
};

export default function UsersPage() {
  return <UsersScreen />;
}
