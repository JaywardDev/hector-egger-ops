export type SupabaseRequestInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  useDefaultAuthorization?: boolean;
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
    const { useDefaultAuthorization = true, ...requestInit } = init;
    const headers = new Headers(requestInit.headers);
    headers.set("apikey", accessToken);

    if (useDefaultAuthorization && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return requestFn(toApiUrl(baseUrl, path), {
      ...requestInit,
      headers,
    });
  },
});
