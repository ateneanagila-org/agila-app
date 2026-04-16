export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <main className="flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">AGILA CATalog</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back.
          </h1>
          <p className="text-sm leading-relaxed text-slate-500">
            Manage Ateneo&apos;s cat colony — log in to access the dashboard.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            className="flex h-11 w-full items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            href="/login"
          >
            Sign In
          </a>
          <a
            className="flex h-11 w-full items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
            href="/overview"
          >
            Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
