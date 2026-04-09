import prisma from "../db.server";

export interface RequestLogEntry {
  id: string;
  shop: string;
  type: string;
  endpoint: string;
  method: string;
  requestBody: string | null;
  responseBody: string | null;
  status: number | null;
  error: string | null;
  durationMs: number | null;
  createdAt: Date;
}

export async function logRequest(
  shop: string,
  type: "incoming" | "outgoing",
  endpoint: string,
  method: string,
  requestBody?: string,
  responseBody?: string,
  status?: number,
  error?: string,
  durationMs?: number
) {
  return prisma.requestLog.create({
    data: {
      shop,
      type,
      endpoint,
      method,
      requestBody: requestBody || null,
      responseBody: responseBody || null,
      status: status || null,
      error: error || null,
      durationMs: durationMs || null,
    },
  });
}

export async function getRecentLogs(shop: string, limit: number = 10) {
  return prisma.requestLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
