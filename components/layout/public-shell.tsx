type PublicShellProps = {
  children: React.ReactNode;
};

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-zinc-900">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Hector Egger Ops</p>
        <h1 className="mt-1 text-lg font-semibold">Operations Platform</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
