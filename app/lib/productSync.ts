import prisma from "../db.server";
import { randomUUID } from "crypto";

export interface SyncResult {
  success: boolean;
  jobId: string;
  processed: number;
  total: number;
  error?: string;
}

export async function syncProductsForShop(shop: string, resumeJobId?: string): Promise<SyncResult> {
  let jobId = resumeJobId ?? "";
  let processed = 0;
  let total = 0;
  let cursorSku: string | null = null;

  try {
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
    } else {
      total = await prisma.shopify_products_final_UK.count({
        where: {
          sku: { not: null },
          price: { not: null },
          part_number: { not: null },
        },
      });

      if (total === 0) {
        return {
          success: true,
          jobId: "",
          processed: 0,
          total: 0,
        };
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

    const eligibleProducts = await prisma.shopify_products_final_UK.findMany({
      where: {
        sku: { not: null },
        price: { not: null },
        part_number: { not: null },
      },
      select: {
        sku: true,
        price: true,
        part_number: true,
      },
      orderBy: { sku: "asc" },
    });

    const startIndex = cursorSku
      ? eligibleProducts.findIndex((product) => product.sku === cursorSku) + 1
      : 0;

    for (let index = startIndex; index < eligibleProducts.length; index++) {
      const product = eligibleProducts[index];

      try {
        if (!product.sku || product.price === null || !product.part_number) {
          continue;
        }

        const currentJob = await prisma.productSyncJob_UK.findUnique({
          where: { id: jobId },
          select: { status: true },
        });

        if (!currentJob) {
          throw new Error("Sync job disappeared during processing");
        }

        if (currentJob.status === "cancelled") {
          return {
            success: false,
            jobId,
            processed,
            total,
            error: "Sync cancelled",
          };
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
        await prisma.productSyncJob_UK.update({
          where: { id: jobId },
          data: {
            processed,
            cursorSku: product.sku,
            updatedAt: new Date(),
          },
        });
      } catch (productError) {
        console.error(`Failed to sync product ${product.sku}:`, productError);
      }
    }

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

    await prisma.productSyncJob_UK.update({
      where: { id: jobId },
      data: {
        status: "completed",
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

export async function getSyncJobStatus(jobId: string) {
  return prisma.productSyncJob_UK.findUnique({
    where: { id: jobId },
  });
}