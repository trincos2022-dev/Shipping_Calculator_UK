import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { calculateShippingForSku } from "../lib/shippingCalculator";

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
  const sku = formData.get("sku");

  if (!sku || typeof sku !== "string") {
    return { success: false, error: "SKU is required" };
  }

  const result = await calculateShippingForSku(sku.trim(), session.shop);

  if (result.success) {
    await prisma.shippingCalculationLog.create({
      data: {
        shop: session.shop,
        sku: result.sku || sku.trim(),
        basePrice: result.basePrice || 0,
        taxAmount: result.taxAmount || 0,
        carrierCharge: result.carrierCharge || 0,
        total: result.total || 0,
        status: "Success",
      },
    });
  } else {
    await prisma.shippingCalculationLog.create({
      data: {
        shop: session.shop,
        sku: sku.trim(),
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
