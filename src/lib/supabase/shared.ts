export type SupabaseRequestInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

export type SupabaseClient = {
  request: (path: string, init?: SupabaseRequestInit) => Promise<Response>;
};

const withLeadingSlash = (path: string) => (path.startsWith("/") ? path : `/${path}`);

const toApiUrl = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}${withLeadingSlash(path)}`;

export const createSupabaseClient = (
  baseUrl: string,
  accessToken: string,
  requestFn: typeof fetch = fetch,
): SupabaseClient => ({
  request: (path, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("apikey", accessToken);
    headers.set("Authorization", `Bearer ${accessToken}`);

    return requestFn(toApiUrl(baseUrl, path), {
      ...init,
      headers,
    });
  },
});
