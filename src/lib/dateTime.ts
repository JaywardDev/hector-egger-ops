export const BUSINESS_TIME_ZONE = "Pacific/Auckland";
export const BUSINESS_LOCALE = "en-NZ";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export const nowUtcIso = () => new Date().toISOString();

const getZonedParts = (date: Date, timeZone = BUSINESS_TIME_ZONE) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(lookup.get("year")),
    month: Number(lookup.get("month")),
    day: Number(lookup.get("day")),
    hour: Number(lookup.get("hour")),
    minute: Number(lookup.get("minute")),
    second: Number(lookup.get("second")),
  };
};

const datePartsToIso = (year: number, month: number, day: number) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const getTodayNzDate = (now = new Date()) => {
  const { year, month, day } = getZonedParts(now);
  return datePartsToIso(year, month, day);
};

const isValidDateParts = (year: number, month: number, day: number) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const parseNzDate = (value: string): string | null => {
  const compact = value.trim();
  if (!compact) return null;

  const isoMatch = compact.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isValidDateParts(year, month, day) ? datePartsToIso(year, month, day) : null;
  }

  const slashMatch = compact.match(SLASH_DATE_PATTERN);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    return isValidDateParts(year, month, day) ? datePartsToIso(year, month, day) : null;
  }

  return null;
};

export const isValidNzDate = (value: string) => parseNzDate(value) !== null;

const requireNzDate = (date: string) => {
  const parsed = parseNzDate(date);
  if (!parsed) {
    throw new Error("A valid NZ business date is required.");
  }
  return parsed;
};

export const addNzDays = (date: string, days: number) => {
  const parsed = requireNzDate(date);
  const [year, month, day] = parsed.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day + days, 12);
  const result = new Date(utc);
  return datePartsToIso(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
};

export const getNzWeekStart = (date = getTodayNzDate()) => {
  const parsed = requireNzDate(date);
  const [year, month, day] = parsed.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12));
  const dayOfWeek = utcDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addNzDays(parsed, mondayOffset);
};

export const getNzWeekEnd = (date = getTodayNzDate()) => addNzDays(getNzWeekStart(date), 6);

export const getNzWeekDates = (date = getTodayNzDate()) => {
  const monday = getNzWeekStart(date);
  return Array.from({ length: 7 }, (_, index) => addNzDays(monday, index));
};

const formatIsoDateToken = (date: Date, timeZone: string) => {
  const { year, month, day } = getZonedParts(date, timeZone);
  return datePartsToIso(year, month, day);
};

export const formatNzDate = (dateOnlyOrTimestamp: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!dateOnlyOrTimestamp) return "—";

  const parsedDateOnly = parseNzDate(dateOnlyOrTimestamp);
  if (parsedDateOnly) {
    if (!options) return parsedDateOnly;
    const [year, month, day] = parsedDateOnly.split("-").map(Number);
    return new Intl.DateTimeFormat(BUSINESS_LOCALE, { timeZone: "UTC", ...options }).format(
      new Date(Date.UTC(year, month - 1, day, 12)),
    );
  }

  const timestamp = new Date(dateOnlyOrTimestamp);
  if (Number.isNaN(timestamp.getTime())) return "—";

  if (!options) return formatIsoDateToken(timestamp, BUSINESS_TIME_ZONE);
  return new Intl.DateTimeFormat(BUSINESS_LOCALE, { timeZone: BUSINESS_TIME_ZONE, ...options }).format(timestamp);
};

export const formatNzDateTime = (timestamp: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(BUSINESS_LOCALE, {
    timeZone: BUSINESS_TIME_ZONE,
    ...(options ?? { dateStyle: "medium", timeStyle: "short" }),
  }).format(date);
};

const zonedDateTimeToUtc = (year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond: number) => {
  const desiredUtcAsLocal = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let guess = desiredUtcAsLocal;

  for (let index = 0; index < 4; index += 1) {
    const parts = getZonedParts(new Date(guess));
    const actualUtcAsLocal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, millisecond);
    const diff = desiredUtcAsLocal - actualUtcAsLocal;
    if (diff === 0) break;
    guess += diff;
  }

  return new Date(guess);
};

export const getNzDayRangeUtc = (date: string) => {
  const parsed = requireNzDate(date);
  const [year, month, day] = parsed.split("-").map(Number);
  const start = zonedDateTimeToUtc(year, month, day, 0, 0, 0, 0);
  const nextDate = addNzDays(parsed, 1).split("-").map(Number);
  const end = zonedDateTimeToUtc(nextDate[0], nextDate[1], nextDate[2], 0, 0, 0, 0);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
};

export const getNzWeekRangeUtc = (date = getTodayNzDate()) => {
  const startDate = getNzWeekStart(date);
  const endExclusiveDate = addNzDays(startDate, 7);
  return {
    startUtc: getNzDayRangeUtc(startDate).startUtc,
    endUtc: getNzDayRangeUtc(endExclusiveDate).startUtc,
  };
};

const toNzDate = (value: string | Date) => {
  if (value instanceof Date) return getTodayNzDate(value);
  return parseNzDate(value) ?? formatNzDate(value);
};

export const isSameNzDate = (a: string | Date, b: string | Date) => toNzDate(a) === toNzDate(b);
