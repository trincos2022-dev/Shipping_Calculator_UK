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
    id: string;
    service_name: string;
    price: string;
    currency: string;
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
    return { rates: [] };
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
        id: "uk-shipping-none",
        service_name: "UK Standard Shipping",
        price: "0.00",
        currency: "GBP",
      }],
    };
  }

  const taxAmount = totalPrice * (settings.taxPercentage / 100);
  const carrierCharge = settings.carrierCharge;
  const finalTotal = totalPrice + taxAmount + carrierCharge;

  console.log("Final calculation:", { totalPrice, taxAmount, carrierCharge, finalTotal });

  const response = {
    rates: [{
      id: "uk-shipping-standard",
      service_name: "UK Standard Shipping",
      price: finalTotal.toFixed(2),
      currency: "GBP",
    }],
  };

  console.log("Final response:", JSON.stringify(response));

  return response;
}

export async function action({ request }: ActionFunctionArgs) {
  const startTime = Date.now();
  const requestBodyStr = await request.text();
  
  // Try to get shop from header (Shopify passes this)
  let shop = request.headers.get("X-Shopify-Shop-Domain") || "";
  
  // Also try URL params
  if (!shop) {
    const url = new URL(request.url);
    shop = url.searchParams.get("shop") || "";
  }
  
  // Fallback to a default if nothing found
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
    const response = { rates: [] };
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
    
    // Log with full response
    await logRequest(
      shop,
      "incoming",
      "/app/api/shipping-rates",
      "POST",
      JSON.stringify({ items: requestBody.rate.items.map(i => ({ sku: i.sku, quantity: i.quantity })) }),
      JSON.stringify(result),
      result.rates.length > 0 ? 200 : 404,
      result.rates.length === 0 ? "No rates returned" : undefined,
      Date.now() - startTime
    );

    console.log("Response being sent:", JSON.stringify(result));

    return Response.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const response = { rates: [] };
    
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
  } catch {
    // Keep as null if parse fails
  }

  if (!requestBody?.rate) {
    const response = { rates: [] };
    await logRequest(
      shop,
      "incoming",
      "/app/api/shipping-rates",
      "POST",
      requestBodyStr.substring(0, 500),
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
      200,
      undefined,
      Date.now() - startTime
    );

    return Response.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const response = { rates: [] };
    
    await logRequest(
      shop,
      "incoming",
      "/app/api/shipping-rates",
      "POST",
      requestBodyStr.substring(0, 500),
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

  const response = { rates: [] };
  
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
