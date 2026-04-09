import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
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
  return result;
};
