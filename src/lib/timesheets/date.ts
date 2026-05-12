import {
  addNzDays,
  formatNzDate,
  getNzWeekDates as getSharedNzWeekDates,
  getTodayNzDate,
} from "@/src/lib/dateTime";

export const getCurrentNzDate = () => getTodayNzDate();

export const addDays = (date: string, days: number) => addNzDays(date, days);

export const getNzWeekDates = (today = getCurrentNzDate()) => getSharedNzWeekDates(today);

export const formatTimesheetDisplayDate = (date: string) =>
  formatNzDate(date, {
    day: "2-digit",
    month: "short",
  });

export const formatTimesheetWeekday = (date: string) =>
  formatNzDate(date, {
    weekday: "long",
  });
