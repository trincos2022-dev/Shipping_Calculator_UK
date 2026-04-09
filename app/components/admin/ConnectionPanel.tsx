import { useState } from "react";
import { useFetcher } from "react-router";
import type { CarrierServiceInfo } from "./types";

interface Props {
  carrierService: CarrierServiceInfo | null;
}

const panelStyles: React.CSSProperties = {
  padding: 16,
  border: "1px solid #d6d8dc",
  borderRadius: 12,
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
};

const buttonStyles: React.CSSProperties = {
  cursor: "pointer",
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  color: "#ffffff",
  fontWeight: 700,
};

const inputStyles: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

export default function ConnectionPanel({ carrierService }: Props) {
  const fetcher = useFetcher();
  const [testShop, setTestShop] = useState("");
  const currentAction = fetcher.formData?.get("intent") as string | null;
  const isRegistering = currentAction === "register" && fetcher.state === "submitting";
  const isDeleting = currentAction === "delete" && fetcher.state === "submitting";

  const callbackUrl = carrierService?.callbackUrl || 
    (typeof window !== "undefined" ? `${window.location.origin}/app/api/shipping-rates` : "");

  const handleTestCallback = async () => {
    if (!testShop.trim()) {
      alert("Please enter your shop domain (e.g., your-store.myshopify.com)");
      return;
    }
    try {
      const response = await fetch(`/app/api/shipping-rates?shop=${encodeURIComponent(testShop)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ sku: "SKU-001", quantity: 1 }]
        })
      });
      const data = await response.json();
      alert("Response:\n" + JSON.stringify(data, null, 2));
    } catch (err) {
      alert("Error: " + err);
    }
  };

  return (
    <section style={panelStyles}>
      <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>Shopify Callback Connection</h2>
      <p style={{ color: "#475569", lineHeight: 1.5, margin: 0, marginBottom: 16 }}>
        Register a carrier service to receive shipping rate requests from Shopify checkout. This enables dynamic shipping calculations.
      </p>

      <div style={{ marginBottom: 16, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
        <div style={{ marginBottom: 10 }}>
          <strong>Callback URL</strong>
          <div style={{ marginTop: 8, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, backgroundColor: "#f8fafc", wordBreak: "break-all" }}>
            {callbackUrl || "Not configured"}
          </div>
        </div>
        <div>
          <strong>Status:</strong>{" "}
          {carrierService ? (
            <span style={{ color: "#16a34a", fontWeight: 600 }}>
              {carrierService.active ? "Active" : "Inactive"}
            </span>
          ) : (
            <span style={{ color: "#dc2626", fontWeight: 600 }}>Not registered</span>
          )}
        </div>
        {carrierService && (
          <div style={{ marginTop: 4 }}>
            <strong>Service:</strong> {carrierService.name} (ID: {carrierService.id})
          </div>
        )}
      </div>

      {fetcher.data && "error" in fetcher.data && (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: "#fee2e2", color: "#991b1b", fontSize: 13 }}>
          Error: {(fetcher.data as { error: string }).error}
        </div>
      )}

      {fetcher.data && "success" in fetcher.data && (fetcher.data as { success: boolean }).success && !carrierService && (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: "#d1fae5", color: "#065f46", fontSize: 13 }}>
          Carrier service registered successfully!
        </div>
      )}

      {carrierService ? (
        <fetcher.Form method="post" action="/app/carrier-service">
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            style={{
              ...buttonStyles,
              backgroundColor: "#dc2626",
              opacity: isDeleting ? 0.7 : 1,
              cursor: isDeleting ? "not-allowed" : "pointer",
            }}
            disabled={isDeleting}
          >
            {isDeleting ? "Removing..." : "Remove Service"}
          </button>
        </fetcher.Form>
      ) : (
        <fetcher.Form method="post" action="/app/carrier-service">
          <input type="hidden" name="intent" value="register" />
          <button
            type="submit"
            style={{
              ...buttonStyles,
              backgroundColor: "#2f6fdb",
              opacity: isRegistering ? 0.7 : 1,
              cursor: isRegistering ? "not-allowed" : "pointer",
            }}
            disabled={isRegistering}
          >
            {isRegistering ? "Registering..." : "Register Carrier Service"}
          </button>
        </fetcher.Form>
      )}

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Test Callback (Local)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={testShop}
            onChange={(e) => setTestShop(e.target.value)}
            placeholder="your-store.myshopify.com"
            style={inputStyles}
          />
          <button
            type="button"
            onClick={handleTestCallback}
            style={{
              ...buttonStyles,
              backgroundColor: "#6b7280",
              whiteSpace: "nowrap",
            }}
          >
            Test
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
          Enter your shop domain to test the callback returns correct rates.
        </div>
      </div>
    </section>
  );
}
