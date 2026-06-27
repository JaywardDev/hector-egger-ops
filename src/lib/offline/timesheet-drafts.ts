import { idbDelete, idbGet, idbSet } from "@/src/lib/offline/idb-store";
import type {
  TimesheetActivityInput,
  TimesheetLeaveType,
  TimesheetWorkMode,
} from "@/src/lib/timesheets/types";

const STORE = "timesheet-drafts" as const;

// An activity row exactly as the daily form keeps it in component state.
export type TimesheetDraftActivity = TimesheetActivityInput & {
  clientId: string;
  hoursText: string;
};

// All user-editable fields of the daily timesheet form, serialised so an
// in-progress day survives a reload or the app being closed.
export type TimesheetDraftSnapshot = {
  workMode: TimesheetWorkMode;
  timeIn: string;
  timeOut: string;
  leaveType: TimesheetLeaveType | "";
  isFullDayLeave: boolean;
  leaveHoursText: string;
  isPublicHoliday: boolean;
  unpaidBreak: boolean;
  paidBreak: boolean;
  activities: TimesheetDraftActivity[];
};

export type StoredTimesheetDraft = {
  snapshot: TimesheetDraftSnapshot;
  updatedAt: string;
};

// Stable per-user, per-day key so drafts never bleed across users on a shared device.
export const timesheetDraftKey = (profileId: string, workDate: string) =>
  `${profileId}:${workDate}`;

export const loadTimesheetDraft = (key: string) =>
  idbGet<StoredTimesheetDraft>(STORE, key);

export const saveTimesheetDraft = (key: string, snapshot: TimesheetDraftSnapshot) =>
  idbSet<StoredTimesheetDraft>(STORE, key, { snapshot, updatedAt: new Date().toISOString() });

export const deleteTimesheetDraft = (key: string) => idbDelete(STORE, key);
