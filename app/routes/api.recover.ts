import prisma from "../db.server";
import { syncProductsForShop } from "../lib/productSync";

export const loader = async () => {
  try {
    const jobs = await prisma.productSyncJob_UK.findMany({
      where: {
        status: { in: ["running", "failed"] },
      },
    });

    for (const job of jobs) {
      try {
        await syncProductsForShop(job.shop, job.id);
      } catch (err) {
        console.error("❌ Job failed:", job.id, err);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Recovery error:", error);
    return new Response("Error", { status: 500 });
  }
};