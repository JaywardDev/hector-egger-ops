import type { AuthSession } from "@/src/lib/auth/session";
import type { AppRole } from "@/src/lib/auth/profile-access";

export type StockTakeActor = {
  session: AuthSession;
  accessContext?: {
    accountStatus: "approved";
    roles: AppRole[];
  };
  route?: string;
};

export type StockAreaRecord = {
  id: string;
  name: string;
  is_active: boolean;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TimberMaterialRecord = {
  id: string;
  height: string;
  width: string;
  length: string;
  grade: string;
  treatment: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TimberStockRowRecord = {
  id: string;
  area_id: string;
  timber_material_id: string;
  bay: string;
  level: string;
  quantity: number;
  updated_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TimberStockWorkingRow = TimberStockRowRecord & {
  timber_name: string;
};

export type TimberStockRowInput = {
  id?: string;
  timberMaterialId: string;
  bay: string;
  level: string;
  quantity: number;
};
