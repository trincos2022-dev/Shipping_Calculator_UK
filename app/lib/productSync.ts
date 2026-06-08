import prisma from "../db.server";
import { randomUUID } from "crypto";

export interface SyncResult {
  success: boolean;
  jobId: string;
  processed: number;
  total: number;
  error?: string;
}

// ✅ tuning knobs
const BATCH_SIZE = 100;
const PROGRESS_UPDATE_INTERVAL = 50;

export async function syncProductsForShop(
  shop: string,
  resumeJobId?: string
): Promise<SyncResult> {
  let jobId = resumeJobId ?? "";
  let processed = 0;
  let total = 0;
  let cursorSku: string | null = null;

  try {
    // ✅ RESUME EXISTING JOB
    if (resumeJobId) {
      const existingJob = await prisma.productSyncJob_UK.findUnique({
        where: { id: resumeJobId },
      });

      if (!existingJob || existingJob.shop !== shop) {
        throw new Error("Sync job not found for this shop");
      }

      if (existingJob.status === "completed") {
        throw new Error("Cannot resume a completed sync job");
      }

      if (existingJob.status === "running") {
        throw new Error("Sync job is already running");
      }

      total = existingJob.total;
      processed = existingJob.processed;
      cursorSku = existingJob.cursorSku ?? null;

      await prisma.productSyncJob_UK.update({
        where: { id: resumeJobId },
        data: {
          status: "running",
          error: null,
          updatedAt: new Date(),
        },
      });

      jobId = resumeJobId;
    } 
    // ✅ CREATE NEW JOB
    else {
      total = await prisma.shopify_products_final_UK.count({
        where: {
          sku: { not: null },
          price: { not: null },
          part_number: { not: null },
        },
      });

      if (total === 0) {
        return { success: true, jobId: "", processed: 0, total: 0 };
      }

      jobId = randomUUID();

      await prisma.productSyncJob_UK.create({
        data: {
          id: jobId,
          shop,
          status: "running",
          processed: 0,
          total,
          cursorSku: null,
        },
      });
    }

    let hasMore = true;

    while (hasMore) {
      // ✅ FETCH NEXT BATCH USING CURSOR
      const products = await prisma.shopify_products_final_UK.findMany({
        where: {
          sku: { not: null },
          price: { not: null },
          part_number: { not: null },
          ...(cursorSku && { sku: { gt: cursorSku } }),
        },
        select: {
          sku: true,
          price: true,
          part_number: true,
        },
        orderBy: { sku: "asc" },
        take: BATCH_SIZE,
      });

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      for (const product of products) {
        try {
          if (!product.sku || product.price === null || !product.part_number) {
            continue;
          }

          // ✅ UPSERT (main work)
          await prisma.productMapping_UK.upsert({
            where: {
              shop_sku: {
                shop,
                sku: product.sku,
              },
            },
            update: {
              price: product.price,
              ingramPartNumber: product.part_number,
            },
            create: {
              shop,
              sku: product.sku,
              price: product.price,
              ingramPartNumber: product.part_number,
            },
          });

          processed++;
          cursorSku = product.sku;

          // ✅ PERIODIC STATUS CHECK + UPDATE
          if (processed % PROGRESS_UPDATE_INTERVAL === 0) {
            const job = await prisma.productSyncJob_UK.findUnique({
              where: { id: jobId },
              select: { status: true },
            });

            if (!job) {
              throw new Error("Sync job disappeared during processing");
            }

            if (job.status === "cancelled") {
              return {
                success: false,
                jobId,
                processed,
                total,
                error: "Sync cancelled",
              };
            }

            await prisma.productSyncJob_UK.update({
              where: { id: jobId },
              data: {
                processed,
                cursorSku,
                updatedAt: new Date(),
              },
            });
          }
        } catch (productError) {
          console.error(`Failed to sync product ${product.sku}:`, productError);
        }
      }
    }

    // ✅ FINAL STATUS CHECK
    const finalJob = await prisma.productSyncJob_UK.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    if (!finalJob) {
      throw new Error("Sync job disappeared before completion");
    }

    if (finalJob.status === "cancelled") {
      return {
        success: false,
        jobId,
        processed,
        total,
        error: "Sync cancelled",
      };
    }

    // ✅ MARK COMPLETED
    await prisma.productSyncJob_UK.update({
      where: { id: jobId },
      data: {
        status: "completed",
        processed,
        cursorSku,
        finishedAt: new Date(),
      },
    });

    return {
      success: true,
      jobId,
      processed,
      total,
    };
  } catch (error) {
    console.error("Product sync failed:", error);

    if (jobId) {
      try {
        await prisma.productSyncJob_UK.update({
          where: { id: jobId },
          data: {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            finishedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error("Failed to update job status:", updateError);
      }
    }

    return {
      success: false,
      jobId: jobId || "",
      processed,
      total,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ✅ CANCEL
export async function cancelSyncJob(jobId: string) {
  const job = await prisma.productSyncJob_UK.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error("Sync job not found");
  }

  if (job.status !== "running") {
    return job;
  }

  return prisma.productSyncJob_UK.update({
    where: { id: jobId },
    data: {
      status: "cancelled",
      updatedAt: new Date(),
    },
  });
}

// ✅ RESUME
export async function resumeSyncJob(jobId: string): Promise<SyncResult> {
  const job = await prisma.productSyncJob_UK.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error("Sync job not found");
  }

  if (job.status === "completed") {
    throw new Error("Cannot resume a completed sync job");
  }

  return syncProductsForShop(job.shop, jobId);
}

// ✅ STATUS
export async function getSyncJobStatus(jobId: string) {
  return prisma.productSyncJob_UK.findUnique({
    where: { id: jobId },
  });
}