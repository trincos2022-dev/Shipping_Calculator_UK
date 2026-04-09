import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { calculateShippingForSku } from "../lib/shippingCalculator";

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

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";

  if (!shop) {
    return Response.json(
      { rates: [], error: "Shop parameter required for testing" },
      { status: 400 }
    );
  }

  let body: CarrierRateRequest = { items: [] };
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Use empty items if parse fails
  }

  const items = body.items || [];

  const settings = await prisma.settings.findUnique({
    where: { shop },
  });

  if (!settings) {
    return Response.json(
      { rates: [], error: "No settings found for shop" },
      { status: 500 }
    );
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

  return Response.json({ rates });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";

  if (!shop) {
    return Response.json(
      { rates: [], error: "Shop parameter required for testing" },
      { status: 400 }
    );
  }

  let body: CarrierRateRequest = { items: [] };
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Use empty items if parse fails
  }

  const items = body.items || [];

  const settings = await prisma.settings.findUnique({
    where: { shop },
  });

  if (!settings) {
    return Response.json(
      { rates: [], error: "No settings found for shop" },
      { status: 500 }
    );
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

  return Response.json({ rates });
}
