"use client";
import { googleLogin } from "./actions";


export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="border border-2 rounded-2xl p-4">
        <button onClick={googleLogin}>Sign In with Google</button>
      </div>
    </div>
  );
}
