import type { Metadata } from "next";
import { googleLogin } from "./actions";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="rounded-2xl border-2 border p-4">
        <button type="button" onClick={googleLogin}>Sign In with Google</button>
      </div>
    </div>
  );
}
