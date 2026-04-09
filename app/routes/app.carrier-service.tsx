import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  findExistingCarrierService,
  registerCarrierServiceForShop,
  deleteCarrierServiceForShop,
  getCarrierServiceFromDb,
} from "../lib/carrierService";

export async function loader({ request }: ActionFunctionArgs) {
  const authResult = await authenticate.admin(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { session } = authResult ?? {};
  if (!session || !session.shop) {
    return { carrierService: null };
  }

  try {
    const carrierService = await findExistingCarrierService(
      session.shop,
      session.accessToken
    );

    if (carrierService) {
      return { carrierService };
    }

    const dbService = await getCarrierServiceFromDb(session.shop);
    if (dbService) {
      return {
        carrierService: {
          id: dbService.serviceId,
          name: dbService.serviceName,
          callbackUrl: dbService.callbackUrl,
          active: dbService.active,
        },
      };
    }

    return { carrierService: null };
  } catch (error) {
    console.error("Error fetching carrier service:", error);
    return { carrierService: null };
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const authResult = await authenticate.admin(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { session } = authResult ?? {};
  if (!session || !session.shop || !session.accessToken) {
    return { success: false, error: "Not authenticated" };
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    if (intent === "register") {
      const service = await registerCarrierServiceForShop(
        session.shop,
        session.accessToken
      );
      return {
        success: true,
        carrierService: {
          id: service.id,
          name: service.name,
          callbackUrl: service.callback_url,
          active: service.active,
        },
      };
    }

    if (intent === "delete") {
      const dbService = await getCarrierServiceFromDb(session.shop);
      if (dbService) {
        await deleteCarrierServiceForShop(
          session.shop,
          session.accessToken,
          dbService.serviceId
        );
      }
      return { success: true, carrierService: null };
    }

    return { success: false, error: "Unknown action" };
  } catch (error) {
    console.error("Carrier service action error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Operation failed",
    };
  }
};
