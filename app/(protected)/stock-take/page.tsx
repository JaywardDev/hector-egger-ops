import Link from "next/link";
import {
  createStockTakeSessionAction,
  deleteEmptyDraftStockTakeSessionAction,
} from "@/app/(protected)/stock-take/actions";
import {
  hasSupervisorOrAdminRole,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import { listStockLocations } from "@/src/lib/inventory/locations";
import { withServerTiming } from "@/src/lib/server-timing";
import { listStockTakeSessions } from "@/src/lib/stock-take/sessions";

type StockTakePageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

const statusBadgeClassName = {
  draft: "bg-zinc-100 text-zinc-700",
  in_progress: "bg-blue-100 text-blue-800",
  submitted: "bg-amber-100 text-amber-800",
  reviewed: "bg-violet-100 text-violet-800",
  closed: "bg-emerald-100 text-emerald-800",
};

const formatLocationLabel = (location: { name: string; code: string | null }) =>
  location.code ? `${location.name} (${location.code})` : location.name;

export default async function StockTakePage({
  searchParams,
}: StockTakePageProps) {
  const route = "/stock-take";

  return withServerTiming({
    name: "StockTakePage",
    route,
    operation: async () => {
      const { session, roles } = await requireProtectedAccess(route);
      const [stockTakeSessions, stockLocations, params] = await Promise.all([
        listStockTakeSessions({
          session,
          accessContext: { accountStatus: "approved", roles },
          route,
        }),
        listStockLocations({ session, route }),
        searchParams,
      ]);
      const canCreateSessions = hasSupervisorOrAdminRole(roles);
      const canDeleteEmptyDraft = hasSupervisorOrAdminRole(roles);

      return (
        <section className="space-y-4 text-sm text-zinc-700">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Stock Take</h2>
            <p className="text-zinc-600">Create and manage stock-take sessions.</p>
          </div>

          {params.success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              {params.success}
            </p>
          ) : null}
          {params.error ? (
            <p className="rounded-md border border-red-50 bg-red-50 px-3 py-2 text-red-700">
              {params.error}
            </p>
          ) : null}

          {canCreateSessions ? (
            <details className="rounded-md border border-zinc-200 bg-white p-3">
              <summary className="cursor-pointer list-none font-medium text-zinc-900">
                Start new stock take
              </summary>
              <form action={createStockTakeSessionAction} className="mt-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Default location
                    </span>
                    <select
                      name="stockLocationId"
                      defaultValue=""
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                    >
                      <option value="">No default location</option>
                      {stockLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {formatLocationLabel(location)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    Session title is generated automatically when the session is
                    created.
                  </p>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Notes
                    </span>
                    <textarea
                      name="notes"
                      placeholder="Notes (optional)"
                      rows={3}
                      className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                >
                  Start stock take
                </button>
              </form>
            </details>
          ) : (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              You can review stock take sessions, but only supervisors and
              admins can create them.
            </p>
          )}

          <div className="space-y-2">
            <h3 className="font-medium text-zinc-900">Sessions</h3>
            {stockTakeSessions.length === 0 ? (
              <p className="rounded-md border border-zinc-200 bg-white px-3 py-3">
                No stock take sessions yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {stockTakeSessions.map((stockTakeSession) => (
                  <li
                    key={stockTakeSession.id}
                    className="rounded-md border border-zinc-200 bg-white p-3"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-zinc-900">
                          {stockTakeSession.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>Status:</span>
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClassName[stockTakeSession.status]}`}
                          >
                            {stockTakeSession.status}
                          </span>
                        </div>
                        <p>
                          Default location:{" "}
                          {stockTakeSession.stock_location
                            ? formatLocationLabel(stockTakeSession.stock_location)
                            : "None"}
                        </p>
                        {stockTakeSession.notes ? (
                          <p>Notes: {stockTakeSession.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/stock-take/${stockTakeSession.id}`}
                          className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                        >
                          Open session
                        </Link>
                        {canDeleteEmptyDraft && stockTakeSession.status === "draft" ? (
                          <form
                            action={deleteEmptyDraftStockTakeSessionAction}
                            onSubmit={(event) => {
                              if (
                                !window.confirm(
                                  "Delete this empty draft session? This action cannot be undone.",
                                )
                              ) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input
                              type="hidden"
                              name="sessionId"
                              value={stockTakeSession.id}
                            />
                            <button
                              type="submit"
                              className="inline-flex rounded-md border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                            >
                              Delete empty draft
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      );
    },
  });
}
