import prisma from "../db.server";
import { randomUUID } from "crypto";

export interface SyncResult {
  success: boolean;
  jobId: string;
  processed: number;
  total: number;
  error?: string;
}

// ✅ tuning knob
const BATCH_SIZE = 100;

export async function syncProductsForShop(
  shop: string,
  resumeJobId?: string,
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

      // ✅ already completed → return
      if (existingJob.status === "completed") {
        return {
          success: true,
          jobId: existingJob.id,
          processed: existingJob.processed,
          total: existingJob.total,
        };
      }

      total = existingJob.total;

      if (!total || total === 0) {
        total = await prisma.shopify_products_final_UK.count({
          where: {
            sku: { not: null },
            price: { not: null },
            part_number: { not: null },
          },
        });

        await prisma.productSyncJob_UK.update({
          where: { id: resumeJobId },
          data: {
            total,  // ✅ FIX: set total if missing
          },
        });
      }
      processed = existingJob.processed;
      cursorSku = existingJob.cursorSku ?? null;

      await prisma.productSyncJob_UK.update({
        where: { id: resumeJobId },
        data: {
          status: "running",
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

    // ✅ FETCH ONLY ONE BATCH (KEY CHANGE FOR VERCEL)
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

    // ✅ NO MORE DATA → COMPLETE JOB
    if (products.length === 0) {
      const job = await prisma.productSyncJob_UK.findUnique({
        where: { id: jobId },
        select: { status: true },
      });

      if (job?.status === "cancelled") {
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
    }

    // ✅ PROCESS ONE BATCH ONLY
    for (const product of products) {
      try {
        if (!product.sku || product.price === null || !product.part_number) {
          continue;
        }

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

      } catch (productError) {
        console.error(`Failed to sync product ${product.sku}:`, productError);
      }
    }

    // ✅ SAVE PROGRESS (CRUCIAL FOR CRON RESUME)
    await prisma.productSyncJob_UK.update({
      where: { id: jobId },
      data: {
        processed,
        cursorSku,
        total,
        updatedAt: new Date(),
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

// ✅ CANCEL (unchanged)
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

// ✅ RESUME (works perfectly with batch model)
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

// ✅ STATUS (unchanged)
export async function getSyncJobStatus(jobId: string) {
  return prisma.productSyncJob_UK.findUnique({
    where: { id: jobId },
  });
}