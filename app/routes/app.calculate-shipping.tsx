import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateShippingForSkus } from "../lib/shippingCalculator";

export const action = async ({ request }: ActionFunctionArgs) => {
  const authResult = await authenticate.admin(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { session } = authResult ?? {};
  if (!session || !session.shop) {
    return { success: false, error: "Not authenticated" };
  }

  const formData = await request.formData();
  const postcode = formData.get("postcode");
  const submittedSkus = formData.getAll("sku");
  const skus = submittedSkus
    .map((sku) => (typeof sku === "string" ? sku.trim() : ""))
    .filter(Boolean);

  if (skus.length === 0) {
    return { success: false, error: "SKU is required" };
  }

  const result = await calculateShippingForSkus(
    skus,
    session.shop,
    typeof postcode === "string" ? postcode.trim() : undefined
  );

  if (result.success && Array.isArray(result.results)) {
    for (const item of result.results) {
      await prisma.shippingCalculationLog_UK.create({
        data: {
          shop: session.shop,
          sku: item.sku || "",
          basePrice: item.basePrice || 0,
          taxAmount: item.taxAmount || 0,
          carrierCharge: item.carrierCharge || 0,
          total: item.total || 0,
          status: "Success",
        },
      });
    }
  } else {
    await prisma.shippingCalculationLog_UK.create({
      data: {
        shop: session.shop,
        sku: skus[0],
        basePrice: 0,
        taxAmount: 0,
        carrierCharge: 0,
        total: 0,
        status: "Failed",
        error: result.error || "Calculation failed",
      },
    });
  }

  return result;
};
