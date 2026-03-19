import Link from "next/link";
import { createStockTakeSessionAction } from "@/app/(protected)/stock-take/actions";
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

      return (
        <section className="space-y-4 text-sm text-zinc-700">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Stock take sessions
            </h2>
            <p className="text-zinc-600">
              Create location-based count sessions and open them for operational
              quantity capture.
            </p>
          </div>

          {params.success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              {params.success}
            </p>
          ) : null}
          {params.error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {params.error}
            </p>
          ) : null}

          {canCreateSessions ? (
            <form
              action={createStockTakeSessionAction}
              className="space-y-2 rounded-md border border-zinc-200 bg-white p-3"
            >
              <h3 className="font-medium text-zinc-900">Create session</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  name="title"
                  placeholder="Session title"
                  required
                  className="rounded-md border border-zinc-300 px-2 py-1.5"
                />
                <select
                  name="stockLocationId"
                  required
                  defaultValue=""
                  className="rounded-md border border-zinc-300 px-2 py-1.5"
                >
                  <option value="" disabled>
                    Select stock location
                  </option>
                  {stockLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {formatLocationLabel(location)}
                    </option>
                  ))}
                </select>
                <textarea
                  name="notes"
                  placeholder="Notes (optional)"
                  rows={3}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 md:col-span-2"
                />
              </div>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
              >
                Create session
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              You can review stock take sessions, but only supervisors and
              admins can create them.
            </p>
          )}

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
                      <p>
                        Location:{" "}
                        {stockTakeSession.stock_location
                          ? formatLocationLabel(stockTakeSession.stock_location)
                          : "Unknown location"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Status:</span>
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClassName[stockTakeSession.status]}`}
                        >
                          {stockTakeSession.status}
                        </span>
                      </div>
                      <p>Notes: {stockTakeSession.notes ?? "—"}</p>
                    </div>
                    <Link
                      href={`/stock-take/${stockTakeSession.id}`}
                      className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                    >
                      Open session
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    },
  });
}
