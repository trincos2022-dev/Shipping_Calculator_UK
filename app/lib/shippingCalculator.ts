import prisma from "../db.server";
import { AdvancedShippingEngine } from "./AdvancedShippingEngine";

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

interface ShippingBreakdown {
  basePrice: number;
  tax: {
    percentage: number;
    amount: number;
  };
  shipping: {
    raw: number;
    final: number;
    reason: string;
  };
  product: {
    weight: number | null | undefined;
    source: string;
  };
}

interface ShippingCalculationWithBreakdown extends ShippingCalculationResult {
  breakdown?: ShippingBreakdown;
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
  "Cloud Solutions",
  "Storage Software",
  "Maintenance & Support Fees",
  "Gift Cards & Certificates"
];

function isTaxOnly(productType?: string | null): boolean {
  return productType
    ? TAX_ONLY_PRODUCT_TYPES.some(
        (type) => type.toLowerCase().trim() === productType.toLowerCase().trim()
      )
    : false;
}

function parseSourceType(sourceType?: string | null): string {
  const raw = (sourceType ?? "unknown").toString().trim();
  let parsedSource = raw;

  if (raw.includes("(")) {
    const match = raw.match(/\(([^)]+)\)/);
    parsedSource = match?.[1] ?? raw;
  }

  parsedSource = parsedSource.toLowerCase();

  console.log("Source Type Raw:", raw);
  console.log("Parsed Source:", parsedSource);

  return parsedSource || "unknown";
}

export async function calculateShippingForSku(
  sku: string,
  shop: string,
  postcode?: string
): Promise<ShippingCalculationWithBreakdown> {
  const settings = await prisma.settings_UK.findUnique({
    where: { shop },
  });

  if (!settings) {
    return { success: false, error: "Settings not found" };
  }

  const product = await prisma.shopify_products_final_UK.findUnique({
    where: { sku },
    select: {
      sku: true,
      title: true,
      price: true,
      product_type: true,
      weight: true,
      source_type: true,
    },
  });

  if (!product || !product.price) {
    return { success: false, error: "Product not found" };
  }

  const normalizedSourceType = parseSourceType(product.source_type);
  const basePrice = Number(product.price);
  const taxAmount = basePrice * (settings.taxPercentage / 100);
  const taxOnly = isTaxOnly(product.product_type);

  const shippingItems = [
    {
      weight: product.weight,
      source_type: normalizedSourceType,
      product_type: product.product_type,
    },
  ];
  
  console.log("📦 [ITEM INPUT]:", {
    dbWeight: product.weight,
    productType: product.product_type
  });

  const engine = new AdvancedShippingEngine();
  const destinationPostcode = postcode?.trim() || "SW1A 1AA";

  console.log("Shipping input:", {
    destinationPostcode,
    shippingItems,
  });

  const dynamicShipping = taxOnly
    ? 0
    : await engine.calculate(shippingItems, destinationPostcode);

  const finalShipping = taxOnly ? 0 : Math.max(dynamicShipping, 5);
  const total = basePrice + taxAmount + finalShipping;

  const breakdown: ShippingBreakdown = {
    basePrice,
    tax: {
      percentage: settings.taxPercentage,
      amount: taxAmount,
    },
    shipping: {
      raw: Number(dynamicShipping),
      final: Number(finalShipping),
      reason: taxOnly
        ? "Tax-only product (no shipping)"
        : "Calculated using weight + supplier split",
    },
    product: {
      weight: product.weight,
      source: normalizedSourceType,
    },
  };

  return {
    success: true,
    sku: product.sku || undefined,
    title: product.title || undefined,
    basePrice: Number(basePrice.toFixed(2)),
    taxPercentage: settings.taxPercentage,
    taxAmount: Number(taxAmount.toFixed(2)),
    carrierCharge: Number(finalShipping.toFixed(2)),
    total: Number(total.toFixed(2)),
    breakdown,
  };
}

export async function calculateShippingForSkus(
  skus: string[],
  shop: string,
  postcode?: string
): Promise<ShippingCalculationResult & { breakdown?: ShippingBreakdown; results?: Array<ShippingCalculationWithBreakdown> }> {
  const normalizedSkus = skus.map((sku) => sku.trim()).filter(Boolean);

  if (normalizedSkus.length === 0) {
    return { success: false, error: "At least one SKU is required" };
  }

  const results: ShippingCalculationWithBreakdown[] = [];

  for (const sku of normalizedSkus) {
    const result = await calculateShippingForSku(sku, shop, postcode);
    results.push(result);
  }

  const combinedCarrierCharge = results.reduce(
    (sum, item) => sum + Number(item.carrierCharge || 0),
    0
  );

  const combinedTaxAmount = results.reduce(
    (sum, item) => sum + Number(item.taxAmount || 0),
    0
  );

  const combinedTotal = results.reduce(
    (sum, item) => sum + Number(item.total || 0),
    0
  );

  return {
    success: true,
    carrierCharge: Number(combinedCarrierCharge.toFixed(2)),
    taxAmount: Number(combinedTaxAmount.toFixed(2)),
    total: Number(combinedTotal.toFixed(2)),
    results,
  };
}