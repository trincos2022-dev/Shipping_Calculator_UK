import { useState, type FormEvent } from "react";
import type { ShippingCalculationResult } from "./types";

interface Props {
  defaultCarrierCharge: number;
  defaultTaxRate: number;
}

const panelStyles: React.CSSProperties = {
  padding: 20,
  border: "1px solid #d6d8dc",
  borderRadius: 12,
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
};

const inputStyles: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
};

const buttonStyles: React.CSSProperties = {
  cursor: "pointer",
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  backgroundColor: "#2f6fdb",
  color: "#ffffff",
  fontWeight: 700,
  transition: "background-color 0.2s ease",
  marginTop: 12,
};

const billStyles: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 8,
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const billRowStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 14,
};

const billTotalStyles: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "12px 0 0",
  fontSize: 16,
  fontWeight: 700,
  color: "#0f172a",
};

export default function ShippingCalculatorPanel({ defaultCarrierCharge, defaultTaxRate }: Props) {
  const [sku, setSku] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ShippingCalculationResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("sku", sku.trim());

      const response = await fetch("/app/calculate-shipping", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: "Failed to calculate shipping",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={panelStyles}>
      <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>Shipping Calculator</h2>
      <p style={{ color: "#475569", lineHeight: 1.5, margin: 0, marginBottom: 16 }}>
        Enter a product SKU to calculate shipping costs using the configured tax rate and carrier charge.
      </p>

      <form method="post" onSubmit={handleSubmit}>
        <label style={{ display: "block", fontWeight: 600, color: "#334155" }}>
          Product SKU
          <input
            type="text"
            name="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Enter SKU (e.g., SKU-12345)"
            style={inputStyles}
            required
          />
        </label>

        <button
          type="submit"
          disabled={isLoading || !sku.trim()}
          style={{
            ...buttonStyles,
            opacity: isLoading || !sku.trim() ? 0.6 : 1,
            cursor: isLoading || !sku.trim() ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Calculating..." : "Calculate Shipping"}
        </button>
      </form>

      {result && (
        <div style={billStyles}>
          {result.success ? (
            <>
              <div style={{ marginBottom: 12, fontWeight: 600, color: "#334155" }}>
                Calculation Result
              </div>
              <div style={billRowStyles}>
                <span style={{ color: "#475569" }}>Base Price</span>
                <span>£{result.basePrice?.toFixed(2)}</span>
              </div>
              <div style={billRowStyles}>
                <span style={{ color: "#475569" }}>Tax ({result.taxPercentage}%)</span>
                <span>£{result.taxAmount?.toFixed(2)}</span>
              </div>
              <div style={billRowStyles}>
                <span style={{ color: "#475569" }}>Carrier Charge</span>
                <span>£{result.carrierCharge?.toFixed(2)}</span>
              </div>
              <div style={billTotalStyles}>
                <span>Total</span>
                <span>£{result.total?.toFixed(2)}</span>
              </div>
              {result.title && (
                <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
                  Product: {result.title}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "#ef4444", fontWeight: 600 }}>
              {result.error || "Calculation failed"}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 14, color: "#334155" }}>
        <strong>Default values:</strong>
        <div>Tax rate: {defaultTaxRate}%</div>
        <div>Carrier charge: £{defaultCarrierCharge}</div>
      </div>
    </section>
  );
}
