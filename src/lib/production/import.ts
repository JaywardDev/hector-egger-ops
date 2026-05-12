import { parseNzDate } from "@/src/lib/dateTime";
import type {
  ProductionDowntimeReasonRecord,
  ProductionInterruptionReasonRecord,
  ProductionOperatorOption,
  ProductionProjectRecord,
} from "@/src/lib/production/types";

export const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeReasonLabel = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const compact = normalizeWhitespace(value);
  if (!compact) {
    return null;
  }

  const withoutDurationSuffix = compact.replace(/\s*\(\s*\d+(?:\.\d+)?\s*\)\s*$/u, "");
  const normalized = normalizeWhitespace(withoutDurationSuffix);
  return normalized.length ? normalized : null;
};

export const parseDurationHoursMinutesSecondsToMinutes = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const compact = normalizeWhitespace(value);
  if (!compact) {
    return null;
  }

  const match = compact.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return Number.NaN;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return Number.NaN;
  }

  if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
    return Number.NaN;
  }

  return Math.round(hours * 60 + minutes + seconds / 60);
};

export const parseDecimalHoursToMinutes = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const compact = normalizeWhitespace(value);
  if (!compact) {
    return 0;
  }

  const parsed = Number(compact);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN;
  }

  return Math.round(parsed * 60);
};

export const normalizeTimeOfDay = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const compact = normalizeWhitespace(value);
  if (!compact) {
    return null;
  }

  const amPmMatch = compact.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))$/);
  const twentyFourHourMatch = compact.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  let hours = Number.NaN;
  let minutes = Number.NaN;
  let seconds = 0;

  if (amPmMatch) {
    const twelveHourValue = Number(amPmMatch[1]);
    minutes = Number(amPmMatch[2]);
    const period = amPmMatch[3].toUpperCase();

    if (twelveHourValue < 1 || twelveHourValue > 12) {
      return null;
    }

    hours = twelveHourValue % 12;
    if (period === "PM") {
      hours += 12;
    }
  } else if (twentyFourHourMatch) {
    hours = Number(twentyFourHourMatch[1]);
    minutes = Number(twentyFourHourMatch[2]);
    seconds = Number(twentyFourHourMatch[3] ?? "00");
  } else {
    return null;
  }

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const normalizeDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const compact = normalizeWhitespace(value);
  if (!compact) {
    return null;
  }

  return parseNzDate(compact);
};

export const normalizeProjectKey = (projectFile: string, projectSequence: number) =>
  `${normalizeWhitespace(projectFile).toLowerCase()}::${projectSequence}`;

export const normalizeLookupKey = (value: string) => normalizeWhitespace(value).toLowerCase();

export const buildProjectLookup = (projects: ProductionProjectRecord[]) =>
  new Map(projects.map((project) => [normalizeProjectKey(project.project_file, project.project_sequence), project]));

export const buildOperatorLookup = (operators: ProductionOperatorOption[]) => {
  const lookup = new Map<string, ProductionOperatorOption>();

  for (const operator of operators) {
    lookup.set(normalizeLookupKey(operator.display_name), operator);
  }

  return lookup;
};

export const buildReasonLookup = <TReason extends ProductionDowntimeReasonRecord | ProductionInterruptionReasonRecord>(
  reasons: TReason[],
) => {
  const byLabel = new Map<string, TReason>();
  const byCode = new Map<string, TReason>();

  for (const reason of reasons) {
    byLabel.set(normalizeLookupKey(reason.label), reason);
    byCode.set(normalizeLookupKey(reason.code), reason);
  }

  return { byLabel, byCode };
};

export const toReasonCode = (label: string) =>
  normalizeLookupKey(label)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "reason";
