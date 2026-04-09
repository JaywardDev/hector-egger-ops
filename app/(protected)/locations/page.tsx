import {
  createStockLocationAction,
  updateStockLocationAction,
} from "@/app/(protected)/locations/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageContainer, Stack } from "@/components/ui/layout";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
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
        <PageContainer className="text-sm text-zinc-700">
          <PageHeader
            title="Locations"
            description="Operational areas used for stock take and material tracking."
          />

          {params.success ? <Alert variant="success">{params.success}</Alert> : null}
          {params.error ? <Alert variant="error">{params.error}</Alert> : null}

          {canWrite ? (
            <details className="space-y-2">
              <summary className="cursor-pointer list-none font-medium text-zinc-900">
                Add location
              </summary>
              <Card className="mt-2">
                <form action={createStockLocationAction} className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <FormField label="Location name" htmlFor="create-location-name">
                    <Input
                      id="create-location-name"
                      name="name"
                      placeholder="Location name"
                      required
                    />
                  </FormField>
                  <FormField label="Location code" htmlFor="create-location-code" helperText="Optional">
                    <Input
                      id="create-location-code"
                      name="code"
                      placeholder="Location code (optional)"
                    />
                  </FormField>
                  <FormField
                    className="md:col-span-2"
                    label="Notes / description"
                    htmlFor="create-location-description"
                    helperText="Optional"
                  >
                    <Textarea
                      id="create-location-description"
                      name="description"
                      placeholder="Notes / description (optional)"
                      rows={2}
                    />
                  </FormField>
                </div>
                  <Button type="submit" variant="secondary">
                    Add location
                  </Button>
                </form>
              </Card>
            </details>
          ) : (
            <Alert>You have read-only access to locations.</Alert>
          )}

          <Stack className="space-y-2">
            <SectionHeader title="Locations" />
            {locations.length === 0 ? (
              <Card>No locations yet.</Card>
            ) : (
              <ul className="space-y-3">
                {locations.map((location) => (
                  <li key={location.id}>
                    <Card>
                      <div className="space-y-1">
                        <p className="font-medium text-zinc-900">{location.name}</p>
                        {location.code ? <p>Code: {location.code}</p> : null}
                        {location.description ? (
                          <p>Description: {location.description}</p>
                        ) : null}
                      </div>

                      {canWrite ? (
                        <Card className="mt-3 bg-zinc-50">
                          <details>
                            <summary className="cursor-pointer list-none font-medium text-zinc-800">
                              Edit {formatLocationLabel(location)}
                            </summary>
                            <form
                              action={updateStockLocationAction}
                              className="mt-3 space-y-3"
                            >
                              <input type="hidden" name="locationId" value={location.id} />
                              <div className="grid gap-2 md:grid-cols-2">
                                <FormField label="Location name" htmlFor={`edit-location-name-${location.id}`}>
                                  <Input
                                    id={`edit-location-name-${location.id}`}
                                    name="name"
                                    defaultValue={location.name}
                                    placeholder="Location name"
                                    required
                                  />
                                </FormField>
                                <FormField
                                  label="Location code"
                                  htmlFor={`edit-location-code-${location.id}`}
                                  helperText="Optional"
                                >
                                  <Input
                                    id={`edit-location-code-${location.id}`}
                                    name="code"
                                    defaultValue={location.code ?? ""}
                                    placeholder="Location code (optional)"
                                  />
                                </FormField>
                                <FormField
                                  className="md:col-span-2"
                                  label="Notes / description"
                                  htmlFor={`edit-location-description-${location.id}`}
                                  helperText="Optional"
                                >
                                  <Textarea
                                    id={`edit-location-description-${location.id}`}
                                    name="description"
                                    defaultValue={location.description ?? ""}
                                    placeholder="Notes / description (optional)"
                                    rows={2}
                                  />
                                </FormField>
                              </div>
                              <Button type="submit" variant="secondary">
                                Save
                              </Button>
                            </form>
                          </details>
                        </Card>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </Stack>
        </PageContainer>
      );
    },
  });
}
