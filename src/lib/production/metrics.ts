import "server-only";

export type ProductionMetricInput = {
  shift_start_time: string;
  shift_end_time: string;
  file_minutes_left_start: number;
  file_minutes_left_end: number;
  downtime_minutes: number;
  interruption_minutes: number;
  actual_volume_cut_m3: number;
};

const parseTimeToMinutes = (time: string) => {
  const [hours, minutes, secondsPart] = time.split(":");
  const seconds = Number(secondsPart ?? "0");
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);

  if (
    !Number.isFinite(parsedHours) ||
    !Number.isFinite(parsedMinutes) ||
    !Number.isFinite(seconds)
  ) {
    return Number.NaN;
  }

  return parsedHours * 60 + parsedMinutes + seconds / 60;
};

export const calculateOperationalMinutes = ({
  shift_start_time,
  shift_end_time,
}: Pick<ProductionMetricInput, "shift_start_time" | "shift_end_time">) => {
  const start = parseTimeToMinutes(shift_start_time);
  const end = parseTimeToMinutes(shift_end_time);
  return end - start;
};

export const calculateProductiveMinutes = ({
  operationalMinutes,
  downtimeMinutes,
}: {
  operationalMinutes: number;
  downtimeMinutes: number;
}) => operationalMinutes - downtimeMinutes;

export const calculateProjectFileDoneMinutes = ({
  fileMinutesLeftStart,
  fileMinutesLeftEnd,
}: {
  fileMinutesLeftStart: number;
  fileMinutesLeftEnd: number;
}) => fileMinutesLeftStart - fileMinutesLeftEnd;

export const calculateMachineEfficiencyPct = ({
  projectFileDoneMinutes,
  downtimeMinutes,
  operationalMinutes,
}: {
  projectFileDoneMinutes: number;
  downtimeMinutes: number;
  operationalMinutes: number;
}) => {
  if (operationalMinutes <= 0) {
    return null;
  }

  return (projectFileDoneMinutes - downtimeMinutes) / operationalMinutes;
};

export const calculateProjectEfficiencyPct = ({
  projectFileDoneMinutes,
  downtimeMinutes,
  interruptionMinutes,
  operationalMinutes,
}: {
  projectFileDoneMinutes: number;
  downtimeMinutes: number;
  interruptionMinutes: number;
  operationalMinutes: number;
}) => {
  if (operationalMinutes <= 0) {
    return null;
  }

  return (
    (projectFileDoneMinutes - downtimeMinutes - interruptionMinutes) /
    operationalMinutes
  );
};

export const calculateCuttingRateM3PerHour = ({
  actualVolumeCutM3,
  operationalMinutes,
}: {
  actualVolumeCutM3: number;
  operationalMinutes: number;
}) => {
  if (operationalMinutes <= 0) {
    return null;
  }

  return actualVolumeCutM3 / (operationalMinutes / 60);
};

export const calculateProjectProgressPct = ({
  latestFileMinutesLeft,
  totalOperationalMinutes,
}: {
  latestFileMinutesLeft: number | null;
  totalOperationalMinutes: number | null;
}) => {
  if (
    latestFileMinutesLeft === null ||
    totalOperationalMinutes === null ||
    totalOperationalMinutes <= 0
  ) {
    return { remainingPct: null, progressPct: null };
  }

  const remainingPct = latestFileMinutesLeft / totalOperationalMinutes;
  return {
    remainingPct,
    progressPct: 1 - remainingPct,
  };
};

export const calculateProductionMetrics = (
  input: ProductionMetricInput,
): {
  operational_minutes: number;
  productive_minutes: number;
  project_file_done_minutes: number;
  cutting_rate_m3_per_hour: number | null;
  machine_efficiency_pct: number | null;
  project_efficiency_pct: number | null;
} => {
  const operationalMinutes = calculateOperationalMinutes(input);
  const projectFileDoneMinutes = calculateProjectFileDoneMinutes({
    fileMinutesLeftStart: input.file_minutes_left_start,
    fileMinutesLeftEnd: input.file_minutes_left_end,
  });

  return {
    operational_minutes: operationalMinutes,
    productive_minutes: calculateProductiveMinutes({
      operationalMinutes,
      downtimeMinutes: input.downtime_minutes,
    }),
    project_file_done_minutes: projectFileDoneMinutes,
    cutting_rate_m3_per_hour: calculateCuttingRateM3PerHour({
      actualVolumeCutM3: input.actual_volume_cut_m3,
      operationalMinutes,
    }),
    machine_efficiency_pct: calculateMachineEfficiencyPct({
      projectFileDoneMinutes,
      downtimeMinutes: input.downtime_minutes,
      operationalMinutes,
    }),
    project_efficiency_pct: calculateProjectEfficiencyPct({
      projectFileDoneMinutes,
      downtimeMinutes: input.downtime_minutes,
      interruptionMinutes: input.interruption_minutes,
      operationalMinutes,
    }),
  };
};
