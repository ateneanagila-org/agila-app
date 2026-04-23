import type { Metadata } from "next";
import { googleLogin } from "./actions";

export const metadata: Metadata = {
  title: "Sign In - AGILA",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-6">
      <div className="w-full max-w-sm">
        {/* Brand/Logo Area */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-brand-green">
            AGILA
          </h1>
          <p className="mt-1 font-heading text-xl font-bold tracking-tight text-brand-orange">
            CATalog
          </p>
        </div>

        {/* Login Card */}
        <div className="overflow-hidden rounded-3xl bg-brand-green p-8 shadow-xl">
          <div className="mb-8 text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand-yellow">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm font-semibold text-white/80">
              Sign in with your Ateneo Google account to manage the catalog.
            </p>
          </div>

          <form action={googleLogin}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-full border border-brand-orange bg-brand-cream px-6 py-4 text-sm font-bold text-brand-orange transition-opacity hover:opacity-90 shadow-sm"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </form>
        </div>
        
        {/* Footer */}
        <p className="mt-8 text-center text-xs font-bold text-brand-dark/40">
          Ateneo de Manila University
        </p>
      </div>
    </div>
  );
}
