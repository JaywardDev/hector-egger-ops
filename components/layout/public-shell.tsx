type PublicShellProps = {
  children: React.ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-900">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[url('/brand/he-auth-background.svg')] bg-cover bg-center bg-no-repeat"
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-zinc-950/10" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen items-center justify-center overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
        <section className="w-full max-w-xl rounded-3xl border border-white/80 bg-white/95 px-6 py-8 shadow-2xl shadow-zinc-950/25 backdrop-blur-sm sm:px-10 sm:py-11">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
              HECTOR EGGER NZ
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Operations Platform
            </h1>
            <div className="mt-4 h-1 w-14 rounded-full bg-[#f2c94c]" />
          </header>

          <div>{children}</div>
        </section>
      </div>
    </main>
  );
}
