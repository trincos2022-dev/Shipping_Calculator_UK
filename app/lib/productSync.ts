import prisma from "../db.server";
import { randomUUID } from "crypto";

export interface SyncResult {
  success: boolean;
  jobId: string;
  processed: number;
  total: number;
  error?: string;
}

export async function syncProductsForShop(shop: string): Promise<SyncResult> {
  let jobId = "";
  let processed = 0;
  let total = 0;

  try {
    // Step 1: Count eligible products
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

    // Step 2: Create sync job
    jobId = randomUUID();
    await prisma.productSyncJob_UK.create({
      data: {
        id: jobId,
        shop,
        status: "running",
        processed: 0,
        total,
      },
    });

    // Step 3: Get eligible products
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
    });

    // Step 4: Process each product
    for (const product of eligibleProducts) {
      try {
        // Ensure values are not null (TypeScript safety)
        if (!product.sku || product.price === null || !product.part_number) {
          continue; // Skip if somehow null
        }

        // Upsert into ProductMapping_UK
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

        // Increment processed and update job
        processed++;
        await prisma.productSyncJob_UK.update({
          where: { id: jobId },
          data: {
            processed,
            updatedAt: new Date(),
          },
        });
      } catch (productError) {
        console.error(`Failed to sync product ${product.sku}:`, productError);
        // Continue to next product - resilient to partial failures
      }
    }

    // Step 5: Mark job as completed
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

    // Update job to failed if it was created
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

// Utility function to get job status
export async function getSyncJobStatus(jobId: string) {
  return prisma.productSyncJob_UK.findUnique({
    where: { id: jobId },
  });
}

// Utility function to resume a failed job (for future implementation)
export async function resumeSyncJob(jobId: string): Promise<SyncResult> {
  // Implementation for resuming would go here
  // For now, return not implemented
  throw new Error("Resume functionality not yet implemented");
}