export const formatStockTakeEntryMappingCode = ({
  bay,
  level,
}: {
  bay: string | null;
  level: string | null;
}) => {
  const normalizedBay = bay?.trim() ?? "";
  const normalizedLevel = level?.trim() ?? "";

  if (normalizedBay && normalizedLevel) {
    return `B${normalizedBay}-L${normalizedLevel}`;
  }

  if (normalizedBay) {
    return `B${normalizedBay}`;
  }

  if (normalizedLevel) {
    return `L${normalizedLevel}`;
  }

  return "";
};
