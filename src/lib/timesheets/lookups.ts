import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { assertTimesheetReadAccess, createSessionHeaders, type TimesheetActor } from "@/src/lib/timesheets/access";
import type { TimesheetLookupOption, TimesheetLookups } from "@/src/lib/timesheets/types";

const select = "id,code,label,is_active,sort_order";

const loadLookup = async (path: string, actor: TimesheetActor): Promise<TimesheetLookupOption[]> => {
  const supabase = createServerSupabaseClient();
  const response = await supabase.request(`${path}?select=${select}&is_active=eq.true&order=sort_order.asc,code.asc`, {
    cache: "no-store",
    headers: createSessionHeaders(actor.session),
  });
  if (!response.ok) throw new Error("Failed to load timesheet lookup options");
  return (await response.json()) as TimesheetLookupOption[];
};

export const getTimesheetLookups = async (actor: TimesheetActor): Promise<TimesheetLookups> => {
  await assertTimesheetReadAccess(actor);
  const [projects, tasks] = await Promise.all([
    loadLookup("/rest/v1/timesheet_projects", actor),
    loadLookup("/rest/v1/timesheet_tasks", actor),
  ]);
  return { projects, tasks };
};
