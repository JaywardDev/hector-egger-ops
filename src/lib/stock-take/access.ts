import "server-only";

import {
  getCurrentAccountStatus,
  getCurrentUserRoles,
} from "@/src/lib/auth/profile-access";
import { formatRoleDisjunction } from "@/src/lib/auth/role-labels";
import type { StockTakeActor } from "@/src/lib/stock-take/types";

const resolveActor = async ({ session, accessContext, route }: StockTakeActor) => {
  const accountStatus =
    accessContext?.accountStatus ??
    (await getCurrentAccountStatus(session, undefined, route));
  const roles =
    accessContext?.roles ?? (await getCurrentUserRoles(session, undefined, route));

  return { accountStatus, roles };
};

export const assertTimberStockReadAccess = async (actor: StockTakeActor) => {
  const { accountStatus } = await resolveActor(actor);
  if (accountStatus !== "approved") {
    throw new Error("Approved account access is required for timber stock.");
  }
};

export const assertTimberStockWriteAccess = async (actor: StockTakeActor) => {
  const { accountStatus, roles } = await resolveActor(actor);
  if (
    accountStatus !== "approved" ||
    !roles.some((role) => ["admin", "supervisor", "operator"].includes(role))
  ) {
    throw new Error(
      `${formatRoleDisjunction(["operator", "supervisor", "admin"])} access is required to update timber stock.`,
    );
  }
};
