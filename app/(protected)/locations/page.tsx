import {
  createStockLocationAction,
  updateStockLocationAction,
} from "@/app/(protected)/locations/actions";
import {
  hasSupervisorOrAdminRole,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import { listStockLocations } from "@/src/lib/inventory/locations";
import { withServerTiming } from "@/src/lib/server-timing";

type LocationsPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

const formatLocationLabel = (location: { name: string; code: string | null }) =>
  location.code ? `${location.name} (${location.code})` : location.name;

export default async function LocationsPage({
  searchParams,
}: LocationsPageProps) {
  const route = "/locations";

  return withServerTiming({
    name: "LocationsPage",
    route,
    operation: async () => {
      const { session, roles } = await requireProtectedAccess(route);
      const [locations, params] = await Promise.all([
        listStockLocations({ session, route }),
        searchParams,
      ]);
      const canWrite = hasSupervisorOrAdminRole(roles);

      return (
        <section className="space-y-4 text-sm text-zinc-700">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Stock locations
            </h2>
            <p className="text-zinc-600">
              Maintain operational storage areas with a clear location name and
              optional code.
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

          {canWrite ? (
            <form
              action={createStockLocationAction}
              className="space-y-2 rounded-md border border-zinc-200 bg-white p-3"
            >
              <h3 className="font-medium text-zinc-900">Create location</h3>
              <p className="text-xs text-zinc-500">
                Name is required. Use code only when a structured reference such
                as B1-L1 is helpful.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  name="name"
                  placeholder="Location name"
                  required
                  className="rounded-md border border-zinc-300 px-2 py-1.5"
                />
                <input
                  name="code"
                  placeholder="Location code (optional)"
                  className="rounded-md border border-zinc-300 px-2 py-1.5"
                />
                <input
                  name="description"
                  placeholder="Notes / description (optional)"
                  className="rounded-md border border-zinc-300 px-2 py-1.5 md:col-span-2"
                />
              </div>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
              >
                Create
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              You have read-only access to stock locations.
            </p>
          )}

          {locations.length === 0 ? (
            <p className="rounded-md border border-zinc-200 bg-white px-3 py-3">
              No stock locations yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {locations.map((location) => (
                <li
                  key={location.id}
                  className="rounded-md border border-zinc-200 bg-white p-3"
                >
                  {canWrite ? (
                    <form
                      action={updateStockLocationAction}
                      className="space-y-3"
                    >
                      <input
                        type="hidden"
                        name="locationId"
                        value={location.id}
                      />
                      <div className="space-y-1">
                        <p className="font-medium text-zinc-900">
                          {formatLocationLabel(location)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Name is primary. Code is optional supplemental metadata.
                        </p>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <input
                          name="name"
                          defaultValue={location.name}
                          placeholder="Location name"
                          required
                          className="rounded-md border border-zinc-300 px-2 py-1.5"
                        />
                        <input
                          name="code"
                          defaultValue={location.code ?? ""}
                          placeholder="Location code (optional)"
                          className="rounded-md border border-zinc-300 px-2 py-1.5"
                        />
                        <input
                          name="description"
                          defaultValue={location.description ?? ""}
                          placeholder="Notes / description (optional)"
                          className="rounded-md border border-zinc-300 px-2 py-1.5 md:col-span-2"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-800 hover:bg-zinc-100"
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-900">
                        {location.name}
                      </p>
                      {location.code ? <p>Code: {location.code}</p> : null}
                      <p>Description: {location.description ?? "—"}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    },
  });
}
