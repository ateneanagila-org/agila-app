export default function Home() {
  return (
    <div className="flex h-screen items-center justify-center font-sans">
      <main className="flex w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Welcome to Agila App.
          </h1>
          <p className="max-w-md pb-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Get started by logging in to your dashboard.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-white px-5 transition-colors hover:bg-[#383838] dark:bg-white dark:text-black dark:hover:bg-[#ccc] md:w-[158px]"
            href="/login"
          >
            Sign In
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="/overview"
          >
            Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
