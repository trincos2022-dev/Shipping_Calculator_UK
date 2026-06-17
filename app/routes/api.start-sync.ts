import prisma from "../db.server";
import { randomUUID } from "crypto";

export const loader = async () => {
  try {
    // ✅ Fetch shops (UPDATE THIS if you have a shop table)
    const shops = await prisma.productSyncJob_UK.groupBy({
      by: ["shop"],
    });

    for (const { shop } of shops) {
      // ✅ Prevent duplicate running jobs
      const existingRunning = await prisma.productSyncJob_UK.findFirst({
        where: {
          shop,
          status: "running",
        },
      });

      if (existingRunning) {
        console.log("⚠️ Job already running for", shop);
        continue;
      }

      // ✅ Create new job (DON'T process here)
      await prisma.productSyncJob_UK.create({
        data: {
          id: randomUUID(),
          shop,
          status: "running",
          processed: 0,
          total: 0,
        },
      });

      console.log("✅ Job queued for shop:", shop);
    }

    return new Response("Jobs created", { status: 200 });

  } catch (error) {
    console.error("❌ Cron start error:", error);
    return new Response("Error", { status: 500 });
  }
};