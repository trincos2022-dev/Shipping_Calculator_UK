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

    // Validate inputs
    if (!taxRateInput || !carrierChargeInput) {
      console.error("Missing form fields:", { taxRateInput, carrierChargeInput });
      return redirect("/app?error=missing-fields");
    }

    const taxRate = parseFloat(taxRateInput as string);
    const carrierCharge = parseFloat(carrierChargeInput as string);

    // Validate parsed values
    if (isNaN(taxRate) || isNaN(carrierCharge)) {
      console.error("Invalid number values:", { taxRate, carrierCharge });
      return redirect("/app?error=invalid-values");
    }

    console.log("Updating settings for shop:", session.shop, { taxRate, carrierCharge });

    const result = await prisma.settings.upsert({
      where: { shop: session.shop },
      update: {
        taxPercentage: taxRate,
        carrierCharge: carrierCharge,
      },
      create: {
        shop: session.shop,
        taxPercentage: taxRate,
        carrierCharge: carrierCharge,
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
  await authenticate.admin(request);

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
