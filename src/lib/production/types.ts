export type ProductionProjectRecord = {
  id: string;
  project_sequence: number;
  project_name: string;
  project_file: string;
  total_time_minutes: number | null;
  total_volume_m3: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductionProjectFileRecord = {
  id: string;
  project_id: string;
  project_name: string;
  project_file: string;
  project_sequence: number | null;
  total_time_minutes: number | null;
  total_volume_m3: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductionProjectFileSummaryRecord = {
  project_file_id: string;
  project_id: string;
  project_file: string;
  project_name: string;
  project_sequence: number | null;
  total_time_minutes: number | null;
  total_volume_m3: number | null;
  total_logged_operational_minutes: number;
  total_volume_cut_m3: number;
  total_downtime_minutes: number;
  total_interruption_minutes: number;
  latest_time_remaining_minutes: number | null;
  is_archived: boolean;
};

export type ProductionDowntimeReasonRecord = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type ProductionInterruptionReasonRecord = ProductionDowntimeReasonRecord;

export type ProductionReasonLineRecord = {
  id: string;
  entry_id: string;
  reason_id: string;
  duration_minutes: number;
  sort_order: number;
  created_at: string;
};

export type ProductionEntryReasonLine = {
  id?: string;
  reasonId: string;
  durationMinutes: number;
  sortOrder?: number;
};

export type ProductionEntryRecord = {
  id: string;
  entry_date: string;
  operator_profile_id: string;
  start_time: string;
  finish_time: string;
  project_id: string;
  project_file_id: string;
  time_remaining_start_minutes: number;
  time_remaining_end_minutes: number;
  actual_volume_cut_m3: number;
  run_through_break: boolean;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
};

export type ProductionEntryWithMetricsRecord = ProductionEntryRecord & {
  operator_name: string;
  project_file: string;
  project_name: string;
  project_sequence: number | null;
  operational_minutes: number;
  downtime_minutes: number;
  interruption_minutes: number;
  project_file_done_minutes: number;
  downtime_reasons: Array<{ id: string; reason_id: string; label: string; duration_minutes: number; sort_order: number }>;
  interruption_reasons: Array<{ id: string; reason_id: string; label: string; duration_minutes: number; sort_order: number }>;
};

export type ProductionProjectSummaryRecord = {
  project_id: string;
  project_file_count: number;
  project_file: string;
  project_name: string;
  project_sequence: number | null;
  total_time_minutes: number | null;
  total_volume_m3: number | null;
  total_logged_operational_minutes: number;
  total_volume_cut_m3: number;
  total_downtime_minutes: number;
  total_interruption_minutes: number;
  latest_time_remaining_minutes: number | null;
  is_archived: boolean;
};

export type ProductionOperatorSummaryRecord = {
  operator_profile_id: string;
  operator_name: string;
  shift_count: number;
  total_operational_minutes: number;
  total_volume_cut_m3: number;
  total_downtime_minutes: number;
  total_interruption_minutes: number;
};

export type ProductionOperatorOption = {
  profile_id: string;
  display_name: string;
};
