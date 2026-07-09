import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { logRequest } from "../lib/requestLog";
import { AdvancedShippingEngine } from "../lib/AdvancedShippingEngine";

interface ShopifyRateItem {
  name: string;
  sku: string;
  quantity: number;
  grams: number;
  price: number;
  vendor: string;
  requires_shipping: boolean;
  taxable: boolean;
  product_id: number;
  variant_id: number;
}

interface ShopifyRateRequest {
  rate: {
    origin: {
      country: string;
      postal_code: string;
      province: string | null;
      city: string | null;
      name: string | null;
      address1: string;
      address2: string | null;
    };
    destination: {
      country: string;
      postal_code: string;
      province: string;
      city: string;
      name: string;
      address1: string;
      address2: string | null;
    };
    items: ShopifyRateItem[];
    currency: string;
    locale: string;
  };
}

interface ShopifyRateResponse {
  rates: Array<{
    service_name: string;
    service_code: string;
    total_price: string;
    currency: string;
    description: string;
  }>;
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
];

function isTaxOnly(productType?: string | null): boolean {
  return productType
    ? TAX_ONLY_PRODUCT_TYPES.some(
        (type) =>
          type.toLowerCase().trim() === productType.toLowerCase().trim()
      )
    : false;
}


// Fetch live USD to GBP exchange rate
async function getUsdToGbpRate(): Promise<number> {
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=GBP");
    if (response.ok) {
      const data = await response.json();
      return data.rates?.GBP || 0.79;
    }
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
  }
  return 0.79; // Fallback rate
}

async function getProduct(shop: string, sku: string): Promise<{
  price: number | null;
  productType: string | null;
  weight: number | null;
  source_type: string | null;
}> {
  let price: number | null = null;
  let productType: string | null = null;
  let weight: number | null = null;
  let source_type: string | null = null;

  const mapping = await prisma.productMapping_UK.findFirst({
    where: { shop, sku },
    select: { price: true },
  });

  if (mapping?.price) price = Number(mapping.price);

  const sourceProduct = await prisma.shopify_products_final_UK.findUnique({
    where: { sku },
    select: {
      price: true,
      product_type: true,
      weight: true,
      source_type: true,
    },
  });

  if (sourceProduct) {
    productType = sourceProduct.product_type;
    weight = sourceProduct.weight;
    source_type = sourceProduct.source_type;

    if (!price && sourceProduct.price) {
      price = Number(sourceProduct.price);
    }
  }

  return { price, productType, weight, source_type };
}

async function processRequest(
  shop: string,
  requestBody: ShopifyRateRequest
): Promise<ShopifyRateResponse> {
  const items = requestBody.rate?.items || [];

  const settings = await prisma.settings_UK.findUnique({
    where: { shop },
  });

  if (!settings) {
    return {
      rates: [
        {
          service_name: "UK Standard Shipping",
          service_code: "UK_STD",
          total_price: "0",
          currency: "GBP",
          description: "Configuration required",
        },
      ],
    };
  }

  // ✅ Exchange rate
  let exchangeRate = await getUsdToGbpRate();
  exchangeRate = exchangeRate * 1.015;

  let totalPriceGbp = 0;
  let hasItems = false;
  let allItemsTaxOnly = true;

  const shippingItems: any[] = [];

  // ✅ SAFETY: postcode fallback
  const postcode =
    requestBody.rate.destination.postal_code || "SW1A 1AA";

  // ✅ LOOP
  for (const item of items) {
    if (!item.requires_shipping) continue;

    hasItems = true;

    const { price: dbPrice, productType, weight, source_type } =
      await getProduct(shop, item.sku);

    if (!isTaxOnly(productType)) {
      allItemsTaxOnly = false;
    }

    let priceGbp: number;

    if (dbPrice !== null) {
      priceGbp = dbPrice;
    } else {
      const priceUsd = Number(item.price) / 100;
      priceGbp = priceUsd * exchangeRate;
    }

    totalPriceGbp += priceGbp * item.quantity;

    // ✅ FIXED: source_type safety
    shippingItems.push({
      sku: item.sku,
      weight: weight || item.grams / 1000 || 1,
      product_type: productType,
      source_type: source_type || "unknown",
      quantity: item.quantity,
    });
  }

  if (!hasItems) {
    return {
      rates: [
        {
          service_name: "UK Standard Shipping",
          service_code: "UK_STD",
          total_price: "0",
          currency: "GBP",
          description: "No shipping required",
        },
      ],
    };
  }

  // ✅ TAX CALCULATION
  const taxAmount =
    totalPriceGbp * (settings.taxPercentage / 100);

  // ✅ SHIPPING ENGINE
  const engine = new AdvancedShippingEngine();

  const expandedItems = shippingItems.flatMap((item) =>
    Array(item.quantity).fill({
      weight: item.weight,
      source_type: item.source_type,
      product_type: item.product_type,
    })
  );

  const dynamicShipping =
    shippingItems.length === 0 || allItemsTaxOnly
      ? 0
      : await engine.calculate(expandedItems, postcode);

  // ✅ PROTECTION: minimum shipping
  const finalShipping = Math.max(dynamicShipping, 5);

  // ✅ FINAL COST
  const shippingCost = taxAmount + finalShipping;

  console.log("✅ Shipping Debug:", {
    postcode,
    totalPriceGbp,
    taxAmount,
    dynamicShipping,
    finalShipping,
    shippingCost,
    shippingItems,
  });

  return {
    rates: [
      {
        service_name: "UK Standard Tax & Shipping",
        service_code: "UK_STD",
        total_price: Math.round(shippingCost * 100).toString(),
        currency: "GBP",
        description: "Standard UK delivery",
      },
    ],
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const startTime = Date.now();
  const requestBodyStr = await request.text();
  
  let shop = request.headers.get("X-Shopify-Shop-Domain") || "";
  
  if (!shop) {
    const url = new URL(request.url);
    shop = url.searchParams.get("shop") || "";
  }
  
  if (!shop) {
    shop = "default";
  }
  
  console.log("Shop domain from request:", shop);
  
  let requestBody: ShopifyRateRequest | null = null;

  try {
    if (requestBodyStr) {
      requestBody = JSON.parse(requestBodyStr);
    }
  } catch {
    // Keep as null if parse fails
  }

  if (!requestBody?.rate) {
    const response = { 
      rates: [{
        service_name: "UK Standard Shipping",
        service_code: "UK_STD",
        total_price: "0",
        currency: "GBP",
        description: "Invalid request",
      }] 
    };
    await logRequest(
      shop,
      "incoming",
      "/app/api/shipping-rates",
      "POST",
      requestBodyStr ? requestBodyStr.substring(0, 500) : "",
      JSON.stringify(response),
      400,
      "Invalid request format - no rate object",
      Date.now() - startTime
    );
    return Response.json(response, { status: 400 });
  }

  try {
    const result = await processRequest(shop, requestBody);
    
    await logRequest(
      shop,
      "incoming",
      "/app/api/shipping-rates",
      "POST",
      JSON.stringify({ items: requestBody.rate.items.map(i => ({ sku: i.sku, quantity: i.quantity })) }),
      JSON.stringify(result),
      result.rates[0]?.total_price !== "0" ? 200 : 404,
      result.rates[0]?.total_price === "0" ? "No valid rates" : undefined,
      Date.now() - startTime
    );

    console.log("Response being sent:", JSON.stringify(result));

    return Response.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const response = { 
      rates: [{
        service_name: "UK Standard Shipping",
        service_code: "UK_STD",
        total_price: "0",
        currency: "GBP",
        description: "Error: " + errorMessage,
      }] 
    };
    
    await logRequest(
      shop,
      "incoming",
      "/app/api/shipping-rates",
      "POST",
      requestBodyStr ? requestBodyStr.substring(0, 500) : "",
      JSON.stringify(response),
      500,
      errorMessage,
      Date.now() - startTime
    );

    return Response.json(response, { status: 500 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "default";

  const response = { 
    rates: [{
      service_name: "UK Standard Shipping",
      service_code: "UK_STD",
      total_price: "0",
      currency: "GBP",
      description: "Use POST method for shipping rates",
    }] 
  };
  
  await logRequest(
    shop,
    "incoming",
    "/app/api/shipping-rates",
    "GET",
    "",
    JSON.stringify(response),
    200,
    undefined,
    Date.now() - startTime
  );

  return Response.json(response);
}
