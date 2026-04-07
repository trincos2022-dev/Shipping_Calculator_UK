import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import ConnectionPanel from "../components/admin/ConnectionPanel";
import RateSettingsPanel from "../components/admin/RateSettings";
import DataTables from "../components/admin/DataTables";
import LogsPanel from "../components/admin/LogsPanel";
import type {
  ConnectionInfo,
  RateSettings,
  MappingRow,
  ProductRow,
  LogRow,
} from "../components/admin/types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const mainData: ProductRow[] = [
    { sku: "UK-1001", title: "Lightweight Carrier Bag", price: "12.99", stock: 23, source: "Supabase" },
    { sku: "UK-1002", title: "Weatherproof Envelope", price: "8.50", stock: 42, source: "Supabase" },
    { sku: "UK-1003", title: "Courier Priority Label", price: "5.00", stock: 104, source: "Supabase" },
  ];

  const mappingRows: MappingRow[] = [
    {
      appSku: "UK-1001",
      shopifySku: "SHOP-01",
      status: "Mapped",
      lastSynced: "2026-04-05 10:32",
      details: "Ready for checkout callback",
    },
    {
      appSku: "UK-1002",
      shopifySku: "SHOP-02",
      status: "Pending",
      lastSynced: "2026-04-06 08:15",
      details: "Awaiting manual sync",
    },
    {
      appSku: "UK-1003",
      shopifySku: "SHOP-03",
      status: "Missing",
      lastSynced: "—",
      details: "No matching Shopify SKU",
    },
  ];

  const logs: LogRow[] = [
    {
      sku: "UK-1001",
      basePrice: "12.99",
      tax: "2.60",
      carrierCharge: "5.00",
      total: "20.59",
      status: "Done",
      note: "Checkout callback success",
      timestamp: "2026-04-06 14:05",
    },
    {
      sku: "UK-1002",
      basePrice: "8.50",
      tax: "1.70",
      carrierCharge: "5.00",
      total: "15.20",
      status: "Failed",
      note: "Webhook validation failed",
      timestamp: "2026-04-06 14:12",
    },
    {
      sku: "UK-1003",
      basePrice: "5.00",
      tax: "1.00",
      carrierCharge: "5.00",
      total: "11.00",
      status: "Done",
      note: "Manual SKU sync recorded",
      timestamp: "2026-04-07 09:40",
    },
  ];

  const connection: ConnectionInfo = {
    connected: false,
    callbackUrl: process.env.SHOPIFY_APP_URL || "",
    checkoutCallbackEnabled: false,
  };

  const rateSettings: RateSettings = {
    taxRate: 20,
    carrierCharge: 5,
  };

  return { mainData, mappingRows, logs, connection, rateSettings };
};

export default function Index() {
  const { mainData, mappingRows, logs, connection, rateSettings } = useLoaderData<typeof loader>();
  const [currentConnection, setCurrentConnection] = useState<ConnectionInfo>(connection);
  const [currentRates, setCurrentRates] = useState<RateSettings>(rateSettings);
  const [currentMapping, setCurrentMapping] = useState<MappingRow[]>(mappingRows);
  const [logEntries, setLogEntries] = useState<LogRow[]>(logs);

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

  const handleSaveRates = (updatedSettings: RateSettings) => {
    setCurrentRates(updatedSettings);
    setLogEntries((current) => [
      {
        sku: "SYSTEM",
        basePrice: "0.00",
        tax: "0.00",
        carrierCharge: "0.00",
        total: "0.00",
        status: "Done",
        note: `Rate defaults updated to ${updatedSettings.taxRate}% tax and £${updatedSettings.carrierCharge} carrier`,
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

      <section style={sectionGridStyles}>
        <ConnectionPanel connection={currentConnection} onToggleConnection={handleToggleConnection} />
        <RateSettingsPanel settings={currentRates} onSaveRates={handleSaveRates} />
      </section>

      <DataTables products={mainData} mappingRows={currentMapping} onManualSync={handleManualSync} />
      <LogsPanel logs={logEntries} />
    </main>
  );
}
