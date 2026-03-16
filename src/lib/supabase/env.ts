const requiredEnvVarError = (name: string) =>
  new Error(
    `Missing required environment variable: ${name}. Add it to your runtime environment (see .env.example).`,
  );

const readEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw requiredEnvVarError(name);
  }

  return value;
};

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

export type SupabaseServerEnv = SupabasePublicEnv & {
  serviceRoleKey: string;
};

export const getSupabasePublicEnv = (): SupabasePublicEnv => ({
  url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
});

export const getSupabaseServerEnv = (): SupabaseServerEnv => ({
  ...getSupabasePublicEnv(),
  serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
});
