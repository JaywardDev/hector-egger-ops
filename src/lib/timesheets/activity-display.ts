import type { TimesheetActivityRecord, TimesheetLookupOption } from "@/src/lib/timesheets/types";

const hasText = (value: string | null | undefined): value is string => Boolean(value?.trim());

export const formatProjectDisplay = (code: string | null | undefined, label: string | null | undefined) => {
  if (hasText(code) && hasText(label)) return `${code} — ${label}`;
  if (hasText(label)) return label;
  if (hasText(code)) return code;
  return null;
};

export const getActivityProjectDisplay = (
  activity: TimesheetActivityRecord,
  projectById: Map<string, TimesheetLookupOption>,
) => {
  const snapshotLabel = formatProjectDisplay(activity.project_code_snapshot, activity.project_label_snapshot);
  if (snapshotLabel) return snapshotLabel;

  const project = projectById.get(activity.project_id);
  return formatProjectDisplay(project?.code, project?.label) ?? "Unknown project";
};

export const getActivityTaskDisplay = (
  activity: TimesheetActivityRecord,
  taskById: Map<string, TimesheetLookupOption>,
) => {
  if (hasText(activity.task_label_snapshot)) return activity.task_label_snapshot;

  const task = taskById.get(activity.task_id);
  return task?.label ?? "Unknown task";
};
