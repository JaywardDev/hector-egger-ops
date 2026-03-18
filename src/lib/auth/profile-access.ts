import "server-only";

import { cache } from "react";
import type { AuthSession } from "@/src/lib/auth/session";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export type AccountStatus = "pending" | "approved" | "disabled";

export type AppRole = "admin" | "supervisor" | "operator";

export type ProfileRecord = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  account_status: AccountStatus;
  onboarding_source: string;
  invited_by_auth_user_id: string | null;
  invited_at: string | null;
  approved_at: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
};

type UserRoleRecord = {
  role: AppRole;
};

export type CurrentProfileAccess = {
  profile: ProfileRecord | null;
  accountStatus: AccountStatus;
  roles: AppRole[];
};

const toSingleRecord = async <T>(response: Response): Promise<T | null> => {
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as T[];
  return data[0] ?? null;
};

const toManyRecords = async <T>(response: Response): Promise<T[]> => {
  if (!response.ok) {
    return [];
  }

  return (await response.json()) as T[];
};

const fetchCurrentProfile = cache(
  async (accessToken: string, userId: string): Promise<ProfileRecord | null> => {
    const supabase = createServerSupabaseClient();
    const response = await supabase.request(
      `/rest/v1/profiles?select=id,auth_user_id,email,full_name,account_status,onboarding_source,invited_by_auth_user_id,invited_at,approved_at,disabled_at,created_at,updated_at&auth_user_id=eq.${userId}&limit=1`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return toSingleRecord<ProfileRecord>(response);
  },
);

const fetchCurrentUserRoles = cache(
  async (accessToken: string, profileId: string): Promise<AppRole[]> => {
    const supabase = createServerSupabaseClient();
    const response = await supabase.request(`/rest/v1/user_roles?select=role&profile_id=eq.${profileId}`, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const rows = await toManyRecords<UserRoleRecord>(response);
    return rows.map((row) => row.role);
  },
);

export const getCurrentProfile = async (
  session: AuthSession | null,
): Promise<ProfileRecord | null> => {
  if (!session) {
    return null;
  }

  return fetchCurrentProfile(session.accessToken, session.user.id);
};

export const getCurrentAccountStatus = async (
  session: AuthSession | null,
  profile?: ProfileRecord | null,
): Promise<AccountStatus> => {
  if (!session) {
    return "pending";
  }

  const resolvedProfile = profile === undefined ? await getCurrentProfile(session) : profile;
  return resolvedProfile?.account_status ?? "pending";
};

export const getCurrentUserRoles = async (
  session: AuthSession | null,
  profile?: ProfileRecord | null,
): Promise<AppRole[]> => {
  if (!session) {
    return [];
  }

  const resolvedProfile = profile === undefined ? await getCurrentProfile(session) : profile;

  if (!resolvedProfile) {
    return [];
  }

  return fetchCurrentUserRoles(session.accessToken, resolvedProfile.id);
};

export const getCurrentProfileAccess = async (
  session: AuthSession | null,
): Promise<CurrentProfileAccess> => {
  const profile = await getCurrentProfile(session);
  const [accountStatus, roles] = await Promise.all([
    getCurrentAccountStatus(session, profile),
    getCurrentUserRoles(session, profile),
  ]);

  return {
    profile,
    accountStatus,
    roles,
  };
};
