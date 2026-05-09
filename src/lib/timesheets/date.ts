const nzDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Pacific/Auckland",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const displayDateFormatter = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-NZ", {
  timeZone: "UTC",
  weekday: "long",
});

export const getCurrentNzDate = () => nzDateFormatter.format(new Date());

export const addDays = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day + days, 12);
  return new Date(utc).toISOString().slice(0, 10);
};

export const getNzWeekDates = (today = getCurrentNzDate()) => {
  const date = new Date(`${today}T12:00:00.000Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(today, mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
};

export const formatTimesheetDisplayDate = (date: string) =>
  displayDateFormatter.format(new Date(`${date}T12:00:00.000Z`));

export const formatTimesheetWeekday = (date: string) =>
  weekdayFormatter.format(new Date(`${date}T12:00:00.000Z`));
