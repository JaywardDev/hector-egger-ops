export const shouldDisableBreakFields = ({
  canEdit,
  isPublicHolidayMode,
  isFullDayLeaveMode,
}: {
  canEdit: boolean;
  isPublicHolidayMode: boolean;
  isFullDayLeaveMode: boolean;
}) => !canEdit || isPublicHolidayMode || isFullDayLeaveMode;

export const shouldDisablePaidBreakControl = ({
  disableBreakFields,
  paidBreakEligible,
}: {
  disableBreakFields: boolean;
  paidBreakEligible: boolean;
}) => disableBreakFields || !paidBreakEligible;
