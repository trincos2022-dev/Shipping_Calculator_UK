import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError, redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import AppNav from "../components/AppNav";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const authResult = await authenticate.admin(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { session } = authResult ?? {};
    if (!session || !session.shop) {
      console.error("No session or shop found");
      return redirect("/?error=no-session");
    }

    const formData = await request.formData();
    const taxRateInput = formData.get("taxRate");
    const carrierChargeInput = formData.get("carrierCharge");
    const usdToGbpRateInput = formData.get("usdToGbpRate");

    // Validate inputs
    if (!taxRateInput || !carrierChargeInput || !usdToGbpRateInput) {
      console.error("Missing form fields:", { taxRateInput, carrierChargeInput, usdToGbpRateInput });
      return redirect("/app?error=missing-fields");
    }

    const taxRate = parseFloat(taxRateInput as string);
    const carrierCharge = parseFloat(carrierChargeInput as string);
    const usdToGbpRate = parseFloat(usdToGbpRateInput as string);

    // Validate parsed values
    if (isNaN(taxRate) || isNaN(carrierCharge) || isNaN(usdToGbpRate)) {
      console.error("Invalid number values:", { taxRate, carrierCharge, usdToGbpRate });
      return redirect("/app?error=invalid-values");
    }

    console.log("Updating settings for shop:", session.shop, { taxRate, carrierCharge, usdToGbpRate });

    const result = await prisma.settings_UK.upsert({
      where: { shop: session.shop },
      update: {
        taxPercentage: taxRate,
        carrierCharge: carrierCharge,
        usdToGbpRate: usdToGbpRate,
      },
      create: {
        shop: session.shop,
        taxPercentage: taxRate,
        carrierCharge: carrierCharge,
        usdToGbpRate: usdToGbpRate,
      },
    });

    console.log("Settings updated successfully:", result);
    return redirect("/app?updated=true");
  } catch (error) {
    console.error("Action error:", error instanceof Error ? error.message : error);
    // Check if it's a redirect response (authentication failure)
    if (error instanceof Response) {
      throw error; // Re-throw redirect responses
    }
    return redirect("/app?error=server-error");
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const authResult = await authenticate.admin(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { session } = authResult ?? {};
  if (!session || !session.shop) {
    console.error("No session or shop found in app loader");
    return redirect("/?error=no-session");
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <AppNav />
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
