export const formatMinutesAsDuration = (minutes: number | null | undefined): string => {
  if (minutes == null || !Number.isFinite(minutes)) {
    return "—";
  }

  const wholeMinutes = Math.max(0, Math.trunc(minutes));
  const hours = Math.floor(wholeMinutes / 60);
  const remainingMinutes = wholeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
};
