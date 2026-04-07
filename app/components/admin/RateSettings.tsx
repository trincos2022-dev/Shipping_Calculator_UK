import { useState, type FormEvent } from "react";
import type { RateSettings } from "./types";

interface Props {
  settings: RateSettings;
  onSaveRates: (settings: RateSettings) => void;
}

const panelStyles: React.CSSProperties = {
  padding: 20,
  border: "1px solid #d6d8dc",
  borderRadius: 12,
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
};

const fieldGroupStyles: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 16,
};

const fieldStyles: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  color: "#334155",
};

const inputStyles: React.CSSProperties = {
  width: "80%",
  marginTop: 8,
  padding: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
};

export default function RateSettingsPanel({ settings, onSaveRates }: Props) {
  const [taxRate, setTaxRate] = useState(settings.taxRate);
  const [carrierCharge, setCarrierCharge] = useState(settings.carrierCharge);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveRates({ taxRate: Number(taxRate), carrierCharge: Number(carrierCharge) });
  };

  return (
    <section style={panelStyles}>
      <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>Rate Defaults</h2>
      <p style={{ color: "#475569", lineHeight: 1.5, margin: 0, marginBottom: 16 }}>
        Update the default tax percentage and fallback carrier charge used for price estimates.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={fieldGroupStyles}>
          <label style={fieldStyles}>
            Tax rate (%)
            <input
              type="number"
              min={0}
              value={taxRate}
              onChange={(event) => setTaxRate(Number(event.target.value))}
              style={inputStyles}
            />
          </label>

          <label style={fieldStyles}>
            Default carrier charge (£)
            <input
              type="number"
              min={0}
              step={0.5}
              value={carrierCharge}
              onChange={(event) => setCarrierCharge(Number(event.target.value))}
              style={inputStyles}
            />
          </label>
        </div>

        <button
          type="submit"
          style={{
            cursor: "pointer",
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "#2f6fdb",
            color: "#ffffff",
            fontWeight: 700,
          }}
        >
          Save rate defaults
        </button>
      </form>

      <div style={{ marginTop: 18, fontSize: 14, color: "#334155" }}>
        <strong>Current fallback values:</strong>
        <div>Tax rate: {settings.taxRate}%</div>
        <div>Carrier charge: £{settings.carrierCharge}</div>
      </div>
    </section>
  );
}
