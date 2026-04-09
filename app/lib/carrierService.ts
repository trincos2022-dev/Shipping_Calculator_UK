import { apiVersion } from "../shopify.server";
import prisma from "../db.server";

export interface CarrierServiceInfo {
  id: number;
  name: string;
  callbackUrl: string;
  active: boolean;
}

const carrierCallbackPath = "/app/api/shipping-rates";

export function getAppCallbackUrl() {
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!appUrl) throw new Error("SHOPIFY_APP_URL is not configured");
  return new URL(carrierCallbackPath, appUrl).toString();
}

async function fetchCarrierServices(shop: string, accessToken: string) {
  const response = await fetch(
    `https://${shop}/admin/api/${apiVersion}/carrier_services.json`,
    {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch carrier services: ${response.status}`);
  }

  const json = (await response.json()) as {
    carrier_services: Array<{
      id: number;
      name: string;
      callback_url: string;
      active: boolean;
    }>;
  };

  return json.carrier_services;
}

export async function findExistingCarrierService(
  shop: string,
  accessToken: string
): Promise<CarrierServiceInfo | null> {
  const services = await fetchCarrierServices(shop, accessToken);
  const callbackUrl = getAppCallbackUrl();
  const match = services.find((s) => s.callback_url === callbackUrl);

  if (!match) return null;

  return {
    id: match.id,
    name: match.name,
    callbackUrl: match.callback_url,
    active: match.active,
  };
}

export async function registerCarrierServiceForShop(
  shop: string,
  accessToken: string
) {
  const callbackUrl = getAppCallbackUrl();
  const serviceName = "UK Shipping Calculator";

  const response = await fetch(
    `https://${shop}/admin/api/${apiVersion}/carrier_services.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        carrier_service: {
          name: serviceName,
          callback_url: callbackUrl,
          service_discovery: true,
          carrier_service_type: "api",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to register carrier service: ${response.status} - ${errorText}`);
  }

  const json = (await response.json()) as {
    carrier_service: {
      id: number;
      name: string;
      callback_url: string;
      active: boolean;
    };
  };

  await prisma.carrierService.upsert({
    where: { shop },
    update: {
      serviceId: json.carrier_service.id,
      serviceName: json.carrier_service.name,
      callbackUrl: json.carrier_service.callback_url,
      active: json.carrier_service.active,
      updatedAt: new Date(),
    },
    create: {
      shop,
      serviceId: json.carrier_service.id,
      serviceName: json.carrier_service.name,
      callbackUrl: json.carrier_service.callback_url,
      active: json.carrier_service.active,
    },
  });

  return json.carrier_service;
}

export async function deleteCarrierServiceForShop(
  shop: string,
  accessToken: string,
  serviceId: number
) {
  const response = await fetch(
    `https://${shop}/admin/api/${apiVersion}/carrier_services/${serviceId}.json`,
    {
      method: "DELETE",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete carrier service: ${response.status}`);
  }

  await prisma.carrierService.delete({
    where: { shop },
  });
}

export async function getCarrierServiceFromDb(shop: string) {
  return prisma.carrierService.findUnique({
    where: { shop },
  });
}
