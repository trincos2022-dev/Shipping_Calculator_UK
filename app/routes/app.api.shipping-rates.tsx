import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { calculateShippingForSku } from "../lib/shippingCalculator";
import { logRequest } from "../lib/requestLog";

interface CarrierRateItem {
  sku: string;
  quantity: number;
}

interface CarrierRateRequest {
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  items: CarrierRateItem[];
}

async function processRequest(shop: string, requestBody: CarrierRateRequest) {
  const items = requestBody.items || [];

  const settings = await prisma.settings.findUnique({
    where: { shop },
  });

  if (!settings) {
    return {
      rates: [],
      error: "No settings found for shop"
    };
  }

  const rates: Array<{
    id: string;
    service_name: string;
    price: string;
    currency: string;
  }> = [];

  if (items.length > 0) {
    for (const item of items) {
      if (item.sku) {
        const result = await calculateShippingForSku(item.sku, shop);

        if (result.success && result.total) {
          rates.push({
            id: `uk-shipping-${item.sku}`,
            service_name: "UK Standard Shipping",
            price: result.total.toFixed(2),
            currency: "GBP",
          });
        } else {
          rates.push({
            id: `uk-shipping-${item.sku}`,
            service_name: "UK Standard Shipping",
            price: (settings.carrierCharge).toFixed(2),
            currency: "GBP",
          });
        }
      }
    }
  }

  if (rates.length === 0) {
    rates.push({
      id: "uk-shipping-default",
      service_name: "UK Standard Shipping",
      price: settings.carrierCharge.toFixed(2),
      currency: "GBP",
    });
  }

  return { rates };
}

export async function action({ request }: ActionFunctionArgs) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  const requestBodyStr = await request.text();
  let requestBody: CarrierRateRequest = { items: [] };
  
  try {
    if (requestBodyStr) {
      requestBody = JSON.parse(requestBodyStr);
    }
  } catch {
    // Use empty items if parse fails
  }

  if (!shop) {
    const response = { rates: [], error: "Shop parameter required" };
    await logRequest(
      shop || "unknown",
      "incoming",
      "/app/api/shipping-rates",
      "POST",
      requestBodyStr,
      JSON.stringify(response),
      400,
      "Missing shop parameter",
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
      requestBodyStr,
      JSON.stringify(result),
      200,
      undefined,
      Date.now() - startTime
    );

    return Response.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const response = { rates: [], error: errorMessage };
    
    await logRequest(
      shop,
      "incoming",
      "/app/api/shipping-rates",
      "POST",
      requestBodyStr,
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
  const shop = url.searchParams.get("shop") || "";
  const requestBodyStr = await request.text();
  let requestBody: CarrierRateRequest = { items: [] };
  
  try {
    if (requestBodyStr) {
      requestBody = JSON.parse(requestBodyStr);
    }
  } catch {
    // Use empty items if parse fails
  }

  if (!shop) {
    const response = { rates: [], error: "Shop parameter required" };
    await logRequest(
      shop || "unknown",
      "incoming",
      "/app/api/shipping-rates",
      "GET",
      requestBodyStr,
      JSON.stringify(response),
      400,
      "Missing shop parameter",
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
      "GET",
      requestBodyStr,
      JSON.stringify(result),
      200,
      undefined,
      Date.now() - startTime
    );

    return Response.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const response = { rates: [], error: errorMessage };
    
    await logRequest(
      shop,
      "incoming",
      "/app/api/shipping-rates",
      "GET",
      requestBodyStr,
      JSON.stringify(response),
      500,
      errorMessage,
      Date.now() - startTime
    );

    return Response.json(response, { status: 500 });
  }
}
