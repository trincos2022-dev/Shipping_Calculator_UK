import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { logRequest } from "../lib/requestLog";

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

async function getProductPrice(shop: string, sku: string): Promise<number | null> {
  const mapping = await prisma.productMapping_UK.findFirst({
    where: { shop, sku },
    select: { price: true },
  });

  if (mapping) {
    return Number(mapping.price);
  }

  const sourceProduct = await prisma.shopify_products_final_UK.findUnique({
    where: { sku },
    select: { price: true },
  });

  if (sourceProduct?.price) {
    return Number(sourceProduct.price);
  }

  return null;
}

async function processRequest(shop: string, requestBody: ShopifyRateRequest): Promise<ShopifyRateResponse> {
  const items = requestBody.rate?.items || [];
  
  console.log("Processing request for shop:", shop);
  console.log("Items received:", items.map(i => ({ sku: i.sku, quantity: i.quantity })));
  
  const settings = await prisma.settings.findUnique({
    where: { shop },
  });

  console.log("Settings found:", settings);

  if (!settings) {
    await logRequest(shop, "incoming", "/app/api/shipping-rates", "POST", "", JSON.stringify({ error: "No settings" }), 500, "No settings for shop", 0);
    return { 
      rates: [{
        service_name: "UK Standard Shipping",
        service_code: "UK_STD",
        total_price: "0",
        currency: "GBP",
        description: "Configuration required",
      }] 
    };
  }

  let totalPrice = 0;
  let hasItems = false;

  for (const item of items) {
    if (!item.requires_shipping) continue;
    
    hasItems = true;
    const dbPrice = await getProductPrice(shop, item.sku);
    const price = dbPrice !== null ? dbPrice : Number(item.price) / 100;
    console.log(`SKU: ${item.sku}, DB Price: ${dbPrice}, Item Price: ${item.price}, Used: ${price}`);
    totalPrice += price * item.quantity;
  }

  console.log("Total price calculated:", totalPrice);

  if (!hasItems) {
    return {
      rates: [{
        service_name: "UK Standard Shipping",
        service_code: "UK_STD",
        total_price: "0",
        currency: "GBP",
        description: "No shipping required for this order",
      }],
    };
  }

  // Calculate only shipping costs: tax on items + carrier charge
  // Note: basePrice is not included - Shopify adds that separately
  const taxAmount = totalPrice * (settings.taxPercentage / 100);
  const carrierCharge = settings.carrierCharge;
  const shippingCost = taxAmount + carrierCharge;

  console.log("Final calculation:", { totalPrice, taxAmount, carrierCharge, shippingCost });

  const response = {
    rates: [{
      service_name: "UK Standard Shipping",
      service_code: "UK_STD",
      total_price: Math.round(shippingCost * 100).toString(),
      currency: "GBP",
      description: "Standard delivery within the UK",
    }],
  };

  console.log("Final response:", JSON.stringify(response));

  return response;
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
