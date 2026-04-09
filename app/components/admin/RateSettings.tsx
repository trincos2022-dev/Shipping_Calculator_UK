import { useState, type FormEvent } from "react";
import type { RateSettings } from "./types";

interface Props {
  settings: RateSettings;
}

const panelStyles: React.CSSProperties = {
  padding: 20,
  border: "1px solid #d6d8dc",
  borderRadius: 12,
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
  transition: "box-shadow 0.3s ease",
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
  transition: "color 0.2s ease",
};

const inputStyles: React.CSSProperties = {
  width: "80%",
  marginTop: 8,
  padding: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  outline: "none",
};

inputStyles[":focus"] = {
  borderColor: "#3b82f6",
  boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
};

export default function RateSettingsPanel({ settings }: Props) {
  const [isHovered, setIsHovered] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const taxRate = (form.elements.namedItem("taxRate") as HTMLInputElement)?.value;
    const carrierCharge = (form.elements.namedItem("carrierCharge") as HTMLInputElement)?.value;
    console.log("Form submitting with:", { taxRate, carrierCharge });
  };

  return (
    <section style={panelStyles}>
      <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>Rate Defaults</h2>
      <p style={{ color: "#475569", lineHeight: 1.5, margin: 0, marginBottom: 16 }}>
        Update the default tax percentage and fallback carrier charge used for price estimates.
      </p>

      <form method="post" onSubmit={handleSubmit}>
        <div style={fieldGroupStyles}>
          <label style={fieldStyles}>
            Tax rate (%)
            <input
              type="number"
              name="taxRate"
              inputMode="decimal"
              min="0"
              defaultValue={settings.taxRate}
              style={inputStyles}
              required
            />
          </label>

          <label style={fieldStyles}>
            Default carrier charge (£)
            <input
              type="number"
              name="carrierCharge"
              inputMode="decimal"
              min="0"
              step="0.5"
              defaultValue={settings.carrierCharge}
              style={inputStyles}
              required
            />
          </label>
        </div>

        <button
          type="submit"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            cursor: "pointer",
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            backgroundColor: isHovered ? "#2563eb" : "#2f6fdb",
            color: "#ffffff",
            fontWeight: 700,
            transition: "background-color 0.2s ease, transform 0.1s ease",
            transform: isHovered ? "translateY(-1px)" : "translateY(0)",
          }}
        >
          Save rate defaults
        </button>
      </form>

      <div style={{ marginTop: 18, fontSize: 14, color: "#334155" }}>
        <strong>Current values:</strong>
        <div>Tax rate: {settings.taxRate}%</div>
        <div>Carrier charge: £{settings.carrierCharge}</div>
      </div>
    </section>
  );
}
