import "server-only";

const formatElapsedMs = (startedAt: number) =>
  Number((performance.now() - startedAt).toFixed(1));

const toRouteLabel = (route?: string) => route ?? "unknown";

const toMetaLabel = (
  meta?: Record<string, string | number | boolean | null | undefined>,
) => {
  if (!meta) {
    return "";
  }

  const entries = Object.entries(meta).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) {
    return "";
  }

  return ` ${entries
    .map(([key, value]) => `${key}=${value === null ? "null" : String(value)}`)
    .join(" ")}`;
};

export const logServerTiming = ({
  name,
  startedAt,
  route,
  meta,
}: {
  name: string;
  startedAt: number;
  route?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}) => {
  console.info(
    `[server-timing] route=${toRouteLabel(route)} fn=${name} elapsed_ms=${formatElapsedMs(startedAt)}${toMetaLabel(meta)}`,
  );
};

export const withServerTiming = async <T>({
  name,
  route,
  meta,
  operation,
}: {
  name: string;
  route?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
  operation: () => Promise<T>;
}): Promise<T> => {
  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    logServerTiming({ name, startedAt, route, meta });
  }
};
