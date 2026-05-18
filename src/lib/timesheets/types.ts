export type TimesheetWorkMode = "factory" | "site" | "office" | "mixed";
export type TimesheetActivityMode = "factory" | "site" | "office";
export type TimesheetStatus = "submitted" | "returned" | "supervisor_approved" | "approved";
export type StaffGroup = "factory" | "site" | "office";
export type TimesheetLeaveType = "annual" | "sick" | "bereavement" | "unpaid" | "other";

export type TimesheetLookupSourceSystem = "manual" | "c_base";

export type TimesheetLookupOption = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  visible_to_staff_groups: StaffGroup[];
  source_system: TimesheetLookupSourceSystem;
  source_row_hash: string | null;
  last_seen_at: string | null;
  inactive_reason: string | null;
  inactive_at: string | null;
};

export type TimesheetPreferenceRecord = {
  profile_id: string;
  preferred_work_mode: TimesheetWorkMode;
};

export type TimesheetActivityRecord = {
  id: string;
  entry_id: string;
  project_id: string;
  task_id: string;
  project_code_snapshot: string | null;
  project_label_snapshot: string | null;
  task_code_snapshot: string | null;
  task_label_snapshot: string | null;
  work_mode: TimesheetActivityMode;
  hours: number;
  sort_order: number;
};

export type TimesheetEntryRecord = {
  id: string;
  profile_id: string;
  work_date: string;
  status: TimesheetStatus;
  time_in: string | null;
  time_out: string | null;
  work_mode: TimesheetWorkMode;
  leave_type: TimesheetLeaveType | null;
  leave_hours: number;
  is_public_holiday: boolean;
  unpaid_break: boolean;
  paid_break: boolean;
  payable_hours: number;
  allocation_hours: number;
  submitted_at: string;
  approved_at: string | null;
  approved_by_profile_id: string | null;
  returned_at: string | null;
  returned_by_profile_id: string | null;
  return_comment: string | null;
  created_at: string;
  updated_at: string;
};

export type TimesheetEntryWithActivities = TimesheetEntryRecord & {
  activities: TimesheetActivityRecord[];
};

export type TimesheetDaySummary = {
  date: string;
  weekdayLabel: string;
  displayDate: string;
  entry: TimesheetEntryWithActivities | null;
  canEdit: boolean;
};

export type TimesheetActivityInput = {
  projectId: string;
  taskId: string;
  workMode: TimesheetActivityMode;
  hours: number;
};

export type SaveTimesheetEntryInput = {
  workDate: string;
  timeIn: string | null;
  timeOut: string | null;
  workMode: TimesheetWorkMode;
  leaveType: TimesheetLeaveType | null;
  leaveHours: number;
  isPublicHoliday: boolean;
  unpaidBreak: boolean;
  paidBreak: boolean;
  activities: TimesheetActivityInput[];
};

export type TimesheetLookups = {
  projects: TimesheetLookupOption[];
  tasks: TimesheetLookupOption[];
};
