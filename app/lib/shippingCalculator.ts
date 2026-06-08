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

const TAX_ONLY_PRODUCT_TYPES = [
  "Security Software",
  "Manufacturing Equipment Repair Services",
  "Document Management Software",
  "Video Surveillance Software",
  "Software Licenses/Upgrades",
  "IT Infrastructure Software",
  "IT Courses",
  "Business Management Software",
  "Barcode & Labelling Software",
  "Warranty & Support",
  "Networking Software",
  "Warranty & Support Extensions",
  "IT Support Services",
  "Communication Software",
  "Multimedia Software",
  "PC Utilities Software",
  "Data Storage Services",
  "Installation Services",
  "Operating Systems",
  "Servers",
  "Cloud Solutions"
];

function isTaxOnly(productType?: string | null): boolean {
  return productType
    ? TAX_ONLY_PRODUCT_TYPES.some(
        (type) =>
          type.toLowerCase().trim() === productType.toLowerCase().trim()
      )
    : false;
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

    // 1️⃣ Try mapped product first for price
    const product = await prisma.productMapping_UK.findFirst({
      where: { shop, sku },
      select: {
        sku: true,
        price: true,
      },
    });

    if (product && product.price) {
      const basePrice = Number(product.price);
      const taxAmount = basePrice * (settings.taxPercentage / 100);

      // Check tax-only status from source product
      const sourceProduct = await prisma.shopify_products_final_UK.findUnique({
        where: { sku },
        select: { product_type: true },
      });
      const taxOnly = isTaxOnly(sourceProduct?.product_type);

      const total = taxOnly
        ? basePrice + taxAmount
        : basePrice + taxAmount + settings.carrierCharge;

      return {
        success: true,
        sku: product.sku || undefined,
        basePrice: Number(basePrice.toFixed(2)),
        taxPercentage: settings.taxPercentage,
        taxAmount: Number(taxAmount.toFixed(2)),
        carrierCharge: taxOnly ? 0 : Number(settings.carrierCharge.toFixed(2)),
        total: Number(total.toFixed(2)),
      };
    }

    // 2️⃣ Fallback to Shopify product
    const sourceProduct = await prisma.shopify_products_final_UK.findUnique({
      where: { sku },
      select: {
        sku: true,
        title: true,
        price: true,
        product_type: true,
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
    const taxOnly = isTaxOnly(sourceProduct.product_type);

    const total = taxOnly
      ? basePrice + taxAmount
      : basePrice + taxAmount + settings.carrierCharge;

    return {
      success: true,
      sku: sourceProduct.sku || undefined,
      title: sourceProduct.title || undefined,
      basePrice: Number(basePrice.toFixed(2)),
      taxPercentage: settings.taxPercentage,
      taxAmount: Number(taxAmount.toFixed(2)),
      carrierCharge: taxOnly ? 0 : Number(settings.carrierCharge.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  } catch (error) {
    console.error("Shipping calculation error:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Calculation failed",
    };
  }
}