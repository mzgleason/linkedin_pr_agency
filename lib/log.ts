import { headers } from "next/headers";

export async function logInfo(message: string, meta?: Record<string, unknown>) {
  const requestId = (await headers()).get("x-request-id");
  const payload = {
    level: "info",
    message,
    requestId: requestId ?? undefined,
    ...meta,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export async function logError(message: string, meta?: Record<string, unknown>) {
  const requestId = (await headers()).get("x-request-id");
  const payload = {
    level: "error",
    message,
    requestId: requestId ?? undefined,
    ...meta,
  };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(payload));
}

