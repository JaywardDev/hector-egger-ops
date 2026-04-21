export type ProductionProjectStatus = "active" | "completed" | "archived";

export type ProductionProjectRecord = {
  id: string;
  project_file: string;
  project_name: string;
  project_sequence: number;
  total_operational_minutes: number | null;
  estimated_total_volume_m3: number | null;
  status: ProductionProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductionDowntimeReasonRecord = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type ProductionInterruptionReasonRecord = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type ProductionEntryRecord = {
  id: string;
  work_date: string;
  operator_profile_id: string;
  shift_start_time: string;
  shift_end_time: string;
  project_id: string;
  file_minutes_left_start: number;
  file_minutes_left_end: number;
  actual_volume_cut_m3: number;
  downtime_minutes: number;
  downtime_reason_id: string | null;
  interruption_minutes: number;
  interruption_reason_id: string | null;
  notes: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
};

export type ProductionEntryWithMetricsRecord = ProductionEntryRecord & {
  operator_name: string;
  project_file: string;
  project_name: string;
  project_sequence: number;
  downtime_reason_code: string | null;
  downtime_reason_label: string | null;
  interruption_reason_code: string | null;
  interruption_reason_label: string | null;
  operational_minutes: number;
  productive_minutes: number;
  project_file_done_minutes: number;
  cutting_rate_m3_per_hour: number | null;
  machine_efficiency_pct: number | null;
  project_efficiency_pct: number | null;
};

export type ProductionProjectSummaryRecord = {
  project_id: string;
  project_file: string;
  project_name: string;
  project_sequence: number;
  total_operational_minutes: number | null;
  total_logged_operational_minutes: number;
  total_volume_cut_m3: number;
  total_downtime_minutes: number;
  total_interruption_minutes: number;
  avg_machine_efficiency_pct: number | null;
  avg_project_efficiency_pct: number | null;
  latest_file_minutes_left: number | null;
  remaining_pct: number | null;
  progress_pct: number | null;
};

export type ProductionOperatorSummaryRecord = {
  operator_profile_id: string;
  operator_name: string;
  shift_count: number;
  total_operational_minutes: number;
  total_volume_cut_m3: number;
  avg_machine_efficiency_pct: number | null;
  avg_project_efficiency_pct: number | null;
  total_downtime_minutes: number;
  total_interruption_minutes: number;
};

export type ProductionOperatorOption = {
  profile_id: string;
  display_name: string;
};
