import { useState, useEffect } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, redirect } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncProductsForShop, cancelSyncJob, resumeSyncJob } from "../lib/productSync";
import ConnectionPanel from "../components/admin/ConnectionPanel";
import RateSettingsPanel from "../components/admin/RateSettings";
import ShippingCalculatorPanel from "../components/admin/ShippingCalculator";
import DataTables from "../components/admin/DataTables";
import LogsPanel from "../components/admin/LogsPanel";
import type {
  ConnectionInfo,
  RateSettings,
  MappingRow,
  ProductRow,
  LogRow,
} from "../components/admin/types";

export const action = async ({ request }: ActionFunctionArgs) => {
  const authResult = await authenticate.admin(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { session } = authResult ?? {};
  if (!session || !session.shop) {
    return redirect("/?error=no-session");
  }

  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "sync-products") {
    try {
      const existingRunningJob = await prisma.productSyncJob_UK.findFirst({
        where: { shop: session.shop, status: "running" },
      });

      if (existingRunningJob) {
        return redirect("/app?sync-error=" + encodeURIComponent("A sync is already running"));
      }

      const result = await syncProductsForShop(session.shop);
      if (result.success) {
        return redirect("/app?sync-success=true&processed=" + result.processed + "&total=" + result.total);
      } else {
        return redirect("/app?sync-error=" + encodeURIComponent(result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Sync action failed:", error);
      return redirect("/app?sync-error=" + encodeURIComponent(error instanceof Error ? error.message : "Sync failed"));
    }
  }

  if (action === "manual-sync") {
    try {
      await prisma.productSyncJob_UK.updateMany({
        where: { shop: session.shop, status: "running" },
        data: {
          status: "cancelled",
          updatedAt: new Date(),
        },
      });

      await prisma.productMapping_UK.deleteMany({
        where: { shop: session.shop },
      });

      const result = await syncProductsForShop(session.shop);
      if (result.success) {
        return redirect("/app?sync-success=true&processed=" + result.processed + "&total=" + result.total);
      }

      return redirect("/app?sync-error=" + encodeURIComponent(result.error || "Unknown error"));
    } catch (error) {
      console.error("Manual sync action failed:", error);
      return redirect("/app?sync-error=" + encodeURIComponent(error instanceof Error ? error.message : "Manual sync failed"));
    }
  }

  if (action === "cancel-sync") {
    const jobId = formData.get("jobId");
    if (!jobId || typeof jobId !== "string") {
      return redirect("/app?sync-error=" + encodeURIComponent("Missing job id"));
    }

    try {
      await cancelSyncJob(jobId);
      return redirect("/app?sync-cancelled=true");
    } catch (error) {
      console.error("Cancel sync action failed:", error);
      return redirect("/app?sync-error=" + encodeURIComponent(error instanceof Error ? error.message : "Cancel failed"));
    }
  }

  if (action === "resume-sync") {
    const jobId = formData.get("jobId");
    if (!jobId || typeof jobId !== "string") {
      return redirect("/app?sync-error=" + encodeURIComponent("Missing job id"));
    }

    try {
      const result = await resumeSyncJob(jobId);
      if (result.success) {
        return redirect("/app?sync-success=true&processed=" + result.processed + "&total=" + result.total);
      }

      return redirect("/app?sync-error=" + encodeURIComponent(result.error || "Unknown error"));
    } catch (error) {
      console.error("Resume sync action failed:", error);
      return redirect("/app?sync-error=" + encodeURIComponent(error instanceof Error ? error.message : "Resume failed"));
    }
  }

  return redirect("/app");
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const authResult = await authenticate.admin(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { session } = authResult ?? {};

  // Count eligible source products from the source-of-truth table.
  const productCount = await prisma.shopify_products_final_UK.count({
    where: {
      sku: { not: null },
      price: { not: null },
      part_number: { not: null },
    },
  });

  const productSamples = await prisma.shopify_products_final_UK.findMany({
    where: {
      sku: { not: null },
      price: { not: null },
      part_number: { not: null },
    },
    select: {
      sku: true,
      title: true,
      inventory_quantity: true,
      price: true,
    },
    take: 50,
  });

  const mainData: ProductRow[] = productSamples.map((p) => ({
    sku: p.sku || "",
    title: p.title || "",
    price: p.price?.toString() || "",
    stock: p.inventory_quantity || 0,
    source: "Supabase",
  }));

  // Fetch mapping statistics and sample mapping rows from ProductMapping_UK.
  const mappingCount = await prisma.productMapping_UK.count({
    where: { shop: session.shop },
  });

  const mappings = await prisma.productMapping_UK.findMany({
    where: { shop: session.shop },
    select: {
      sku: true,
      price: true,
      ingramPartNumber: true,
      updatedAt: true,
    },
    take: 50,
  });

  const mappingRows: MappingRow[] = mappings.map((m) => ({
    appSku: m.sku,
    shopifySku: m.sku,
    status: "Mapped",
    lastSynced: m.updatedAt.toLocaleString(),
    details: `Part: ${m.ingramPartNumber}`,
  }));

  const latestSyncJob = await prisma.productSyncJob_UK.findFirst({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  const logs: LogRow[] = [
    {
      sku: "SYSTEM",
      basePrice: "0.00",
      tax: "0.00",
      carrierCharge: "0.00",
      total: "0.00",
      status: "Info",
      note: `${mappingCount} products mapped, ${productCount} available in source`,
      timestamp: new Date().toLocaleString(),
    },
  ];

  const connection: ConnectionInfo = {
    connected: false,
    callbackUrl: process.env.SHOPIFY_APP_URL || "",
    checkoutCallbackEnabled: false,
  };

  // Fetch or create shop-specific rate settings
  let settings = await prisma.settings.findUnique({
    where: { shop: session.shop },
  });
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        shop: session.shop,
        taxPercentage: 20,
        carrierCharge: 5,
      },
    });
  }
  const rateSettings: RateSettings = {
    taxRate: settings.taxPercentage,
    carrierCharge: settings.carrierCharge,
  };

  return { mainData, mappingRows, logs, connection, rateSettings, productCount, mappingCount, latestSyncJob };
};

export default function Index() {
  const { mainData, mappingRows, logs, connection, rateSettings, productCount, mappingCount, latestSyncJob } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [currentConnection, setCurrentConnection] = useState<ConnectionInfo>(connection);
  const [currentRates, setCurrentRates] = useState<RateSettings>(rateSettings);
  const [currentMapping, setCurrentMapping] = useState<MappingRow[]>(mappingRows);
  const [logEntries, setLogEntries] = useState<LogRow[]>(logs);

  const showSuccess = searchParams.get("updated") === "true";
  const errorMessage = searchParams.get("error");
  const syncSuccess = searchParams.get("sync-success") === "true";
  const syncError = searchParams.get("sync-error");
  const syncCancelled = searchParams.get("sync-cancelled") === "true";
  const processed = searchParams.get("processed");
  const total = searchParams.get("total");

  // Update local state when rateSettings changes (from loader after redirect)
  useEffect(() => {
    setCurrentRates(rateSettings);
  }, [rateSettings]);

  // Auto-hide success/error messages after 5 seconds
  useEffect(() => {
    if (showSuccess || errorMessage || syncSuccess || syncError) {
      const timer = setTimeout(() => {
        // Clear the query params by replacing the URL without the notification params
        window.history.replaceState({}, "", "/app");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, errorMessage, syncSuccess, syncError]);

  const pageStyles: React.CSSProperties = {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 20px 40px",
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  };

  const sectionGridStyles: React.CSSProperties = {
    display: "grid",
    gap: 20,
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  };

  const headerStyles: React.CSSProperties = {
    marginBottom: 30,
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
    transition: "box-shadow 0.3s ease",
  };

  const handleToggleConnection = (connected: boolean) => {
    setCurrentConnection((prev) => ({
      ...prev,
      connected,
      checkoutCallbackEnabled: connected,
    }));

    setLogEntries((current) => [
      {
        sku: "SYSTEM",
        basePrice: "0.00",
        tax: "0.00",
        carrierCharge: "0.00",
        total: "0.00",
        status: "Done",
        note: connected ? "Shopify callback connected" : "Shopify callback disconnected",
        timestamp: new Date().toLocaleString(),
      },
      ...current,
    ]);
  };

  const handleManualSync = () => {
    setCurrentMapping((rows) =>
      rows.map((row) =>
        row.status === "Missing"
          ? row
          : {
              ...row,
              status: "Synced",
              lastSynced: new Date().toLocaleString(),
              details: "Manual sync completed",
            },
      ),
    );

    setLogEntries((current) => [
      {
        sku: "BULK",
        basePrice: "0.00",
        tax: "0.00",
        carrierCharge: "0.00",
        total: "0.00",
        status: "Done",
        note: "Manual sync completed",
        timestamp: new Date().toLocaleString(),
      },
      ...current,
    ]);
  };

  return (
    <main style={pageStyles}>
      <header style={headerStyles}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#2563eb" }}>
          Admin dashboard
        </p>
        <h1 style={{ margin: "8px 0 0", fontSize: 32 }}>Shipping Calculator Control Center</h1>
        <p style={{ margin: "14px 0 0", maxWidth: 760, color: "#475569", lineHeight: 1.7 }}>
          Manage Shopify callback connectivity, SKU mapping synchronization, rate defaults, and delivery logs from one central admin screen.
        </p>
      </header>

      {syncSuccess && (
        <div style={{
          marginBottom: 20,
          padding: 12,
          borderRadius: 8,
          backgroundColor: "#d1fae5",
          border: "1px solid #10b981",
          color: "#065f46",
          fontWeight: 600,
          transition: "all 0.3s ease",
        }}>
          ✓ Product sync completed! Synced {processed}/{total} products.
        </div>
      )}

      {syncError && (
        <div style={{
          marginBottom: 20,
          padding: 12,
          borderRadius: 8,
          backgroundColor: "#fee2e2",
          border: "1px solid #ef4444",
          color: "#991b1b",
          fontWeight: 600,
          transition: "all 0.3s ease",
        }}>
          ✗ Sync failed: {decodeURIComponent(syncError)}
        </div>
      )}

      {syncCancelled && (
        <div style={{
          marginBottom: 20,
          padding: 12,
          borderRadius: 8,
          backgroundColor: "#fef3c7",
          border: "1px solid #fde68a",
          color: "#92400e",
          fontWeight: 600,
          transition: "all 0.3s ease",
        }}>
          ⚠️ Sync was cancelled. You can resume it from where it stopped.
        </div>
      )}

      {showSuccess && (
        <div style={{
          marginBottom: 20,
          padding: 12,
          borderRadius: 8,
          backgroundColor: "#d1fae5",
          border: "1px solid #10b981",
          color: "#065f46",
          fontWeight: 600,
          transition: "all 0.3s ease",
        }}>
          ✓ Rate settings updated successfully!
        </div>
      )}

      {errorMessage && (
        <div style={{
          marginBottom: 20,
          padding: 12,
          borderRadius: 8,
          backgroundColor: "#fee2e2",
          border: "1px solid #ef4444",
          color: "#991b1b",
          fontWeight: 600,
          transition: "all 0.3s ease",
        }}>
          ✗ Error: {
            errorMessage === "missing-fields" 
              ? "Please fill in all fields" 
              : errorMessage === "invalid-values"
              ? "Invalid number values"
              : "Server error - please try again"
          }
        </div>
      )}

      <section style={sectionGridStyles}>
        <ConnectionPanel connection={currentConnection} onToggleConnection={handleToggleConnection} />
        <RateSettingsPanel settings={currentRates} />
      </section>

      <div style={{ marginTop: 20 }}>
        <ShippingCalculatorPanel 
          defaultCarrierCharge={currentRates.carrierCharge} 
          defaultTaxRate={currentRates.taxRate} 
        />
      </div>

      <DataTables products={mainData} mappingRows={currentMapping} productCount={productCount} mappingCount={mappingCount} latestSyncJob={latestSyncJob} />
      <LogsPanel logs={logEntries} />
    </main>
  );
}
