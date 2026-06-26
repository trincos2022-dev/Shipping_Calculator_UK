import { useState, type FormEvent } from "react";
import type { ShippingCalculationResult } from "./types";

interface ExtendedResult extends ShippingCalculationResult {
  breakdown?: {
    basePrice: number;
    tax: {
      percentage: number;
      amount: number;
    };
    shipping: {
      raw: number;
      final: number;
      reason: string;
    };
    product: {
      weight?: number;
      source?: string;
    };
  };
}

interface MultiResult {
  success: boolean;
  error?: string;
  results?: ExtendedResult[];
  carrierCharge?: number;
  taxAmount?: number;
  total?: number;
}

interface Props {
  defaultCarrierCharge: number;
  defaultTaxRate: number;
}

interface SkuRow {
  id: number;
  value: string;
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
};

const buttonStyles: React.CSSProperties = {
  cursor: "pointer",
  padding: "10px 18px",
  borderRadius: 8,
  border: "none",
  backgroundColor: "#2f6fdb",
  color: "#fff",
  fontWeight: 700,
  marginTop: 12,
};

const billStyles: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 8,
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const row = (bold = false) => ({
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  fontSize: 14,
  fontWeight: bold ? 700 : 400,
});

export default function ShippingCalculatorPanel({
  defaultCarrierCharge,
  defaultTaxRate,
}: Props) {
  const [skuRows, setSkuRows] = useState<SkuRow[]>([{ id: 1, value: "" }]);
  const [postcode, setPostcode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MultiResult | null>(null);

  const updateSkuRow = (id: number, value: string) => {
    setSkuRows((rows) => rows.map((row) => (row.id === id ? { ...row, value } : row)));
  };

  const addSkuRow = () => {
    setSkuRows((rows) => [...rows, { id: Date.now(), value: "" }]);
  };

  const removeSkuRow = (id: number) => {
    setSkuRows((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : rows));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const skus = skuRows.map((row) => row.value.trim()).filter(Boolean);
    if (skus.length === 0) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      skus.forEach((sku) => formData.append("sku", sku));
      formData.append("postcode", postcode.trim());

      const response = await fetch("/app/calculate-shipping", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch {
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
      <h2>Shipping Calculator</h2>
      <p style={{ color: "#475569" }}>
        Enter one or more SKUs and optionally a destination postcode to calculate shipping using the advanced engine.
      </p>

      <form onSubmit={handleSubmit}>
        {skuRows.map((row, index) => (
          <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={row.value}
              onChange={(e) => updateSkuRow(row.id, e.target.value)}
              placeholder={`SKU ${index + 1}`}
              style={{ ...inputStyles, marginTop: 8, marginBottom: 4 }}
            />

            {skuRows.length > 1 && (
              <button
                type="button"
                onClick={() => removeSkuRow(row.id)}
                style={{
                  marginTop: 8,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "#64748b",
                }}
                aria-label="Remove SKU"
              >
                ×
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addSkuRow}
          style={{
            marginTop: 8,
            border: "none",
            background: "transparent",
            color: "#2563eb",
            cursor: "pointer",
            fontWeight: 600,
            padding: 0,
          }}
        >
          ＋ Add SKU
        </button>

        <input
          type="text"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          placeholder="Optional postcode (e.g. SW1A 1AA)"
          style={inputStyles}
        />

        <button
          type="submit"
          disabled={isLoading || skuRows.every((row) => !row.value.trim())}
          style={{
            ...buttonStyles,
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? "Calculating..." : "Calculate"}
        </button>
      </form>

      {result && (
        <div style={billStyles}>
          {result.success ? (
            <>
              <div style={row(true)}>
                <span>Items</span>
                <span>{result.results?.length ?? 1}</span>
              </div>

              {(result.results ?? []).map((item, index) => (
                <div
                  key={item.sku || index}
                  style={{
                    marginTop: 10,
                    padding: 10,
                    background: "#ffffff",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <strong>{item.title || item.sku || `SKU ${index + 1}`}</strong>

                  {item.success ? (
                    <>
                      <div style={{ marginTop: 6 }}>
                        Base Price: £{Number(item.basePrice || 0).toFixed(2)}
                      </div>
                      <div>Tax: £{Number(item.taxAmount || 0).toFixed(2)}</div>
                      <div>Shipping: £{Number(item.carrierCharge || 0).toFixed(2)}</div>
                      <div>Total: £{Number(item.total || 0).toFixed(2)}</div>

                      {item.breakdown && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: 8,
                            background: "#f1f5f9",
                            borderRadius: 6,
                            fontSize: 13,
                          }}
                        >
                          <strong>Detailed Breakdown</strong>

                          <div style={{ marginTop: 6 }}>
                            Weight: {item.breakdown.product.weight || "N/A"} kg
                          </div>

                          <div>Source: {item.breakdown.product.source || "Unknown"}</div>

                          <div style={{ marginTop: 6 }}>{item.breakdown.shipping.reason}</div>

                          <div style={{ marginTop: 4 }}>
                            Raw Shipping: £{Number(item.breakdown.shipping.raw || 0).toFixed(2)}
                          </div>

                          <div>
                            Final Shipping (min applied): £{Number(item.breakdown.shipping.final || 0).toFixed(2)}
                          </div>

                          <div style={{ marginTop: 4 }}>
                            Tax Applied: {item.breakdown.tax.percentage}%
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ marginTop: 6, color: "#dc2626" }}>
                      {item.error || "Unable to calculate shipping for this SKU."}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: "red" }}>{result.error}</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 15 }}>
        <strong>Defaults:</strong>
        <div>Tax: {defaultTaxRate}%</div>
        <div>Old Flat Shipping: £{defaultCarrierCharge}</div>
      </div>
    </section>
  );
}