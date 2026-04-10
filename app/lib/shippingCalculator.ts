import prisma from "../db.server";

export interface ShippingCalculationResult {
  success: boolean;
  sku?: string;
  title?: string;
  basePrice?: number;
  taxPercentage?: number;
  taxAmount?: number;
  carrierCharge?: number;
  total?: number;
  error?: string;
}

export async function calculateShippingForSku(
  sku: string,
  shop: string
): Promise<ShippingCalculationResult> {
  try {
    const settings = await prisma.settings_UK.findUnique({
      where: { shop },
    });

    if (!settings) {
      return {
        success: false,
        error: "Rate settings not configured",
      };
    }

    const product = await prisma.productMapping_UK.findFirst({
      where: {
        shop,
        sku,
      },
      select: {
        sku: true,
        price: true,
      },
    });

    if (!product) {
      const sourceProduct = await prisma.shopify_products_final_UK.findUnique({
        where: { sku },
        select: {
          sku: true,
          title: true,
          price: true,
        },
      });

      if (!sourceProduct || !sourceProduct.price) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const basePrice = Number(sourceProduct.price);
      const taxAmount = basePrice * (settings.taxPercentage / 100);
      const total = basePrice + taxAmount + settings.carrierCharge;

      return {
        success: true,
        sku: sourceProduct.sku || undefined,
        title: sourceProduct.title || undefined,
        basePrice,
        taxPercentage: settings.taxPercentage,
        taxAmount: Math.round(taxAmount * 100) / 100,
        carrierCharge: settings.carrierCharge,
        total: Math.round(total * 100) / 100,
      };
    }

    const basePrice = Number(product.price);
    const taxAmount = basePrice * (settings.taxPercentage / 100);
    const total = basePrice + taxAmount + settings.carrierCharge;

    return {
      success: true,
      sku: product.sku || undefined,
      basePrice,
      taxPercentage: settings.taxPercentage,
      taxAmount: Math.round(taxAmount * 100) / 100,
      carrierCharge: settings.carrierCharge,
      total: Math.round(total * 100) / 100,
    };
  } catch (error) {
    console.error("Shipping calculation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Calculation failed",
    };
  }
}
