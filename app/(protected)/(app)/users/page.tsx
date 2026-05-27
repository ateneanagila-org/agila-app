import type { Metadata } from "next";
import { UsersScreen } from "@/components/app-pages/users/users-screen";

export const maxDuration = 120;

export const metadata: Metadata = {
  title: "User Control",
};

export default function UsersPage() {
  return <UsersScreen />;
}
