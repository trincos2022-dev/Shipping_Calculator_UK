import { useEffect, useState } from "react";

const containerStyle: React.CSSProperties = {
  marginTop: 30,
  padding: 20,
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 15,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "2px solid #e2e8f0",
  fontSize: 14,
  color: "#334155",
};

const tdStyle: React.CSSProperties = {
  padding: "8px",
  borderBottom: "1px solid #e2e8f0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #cbd5f5",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
};

export default function ShippingRulesPanel() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/app/api/shipping-rules")
      .then((res) => res.json())
      .then((data) => {
        setRules(data.rules);
        setLoading(false);
      });
  }, []);

  const updateRule = (index: number, field: string, value: any) => {
    const updated = [...rules];
    updated[index][field] = value;
    setRules(updated);
  };

  const addRow = () => {
    setRules([
      ...rules,
      {
        zone_code: "ZONE_1",
        min_weight: 0,
        max_weight: 0,
        price: 0,
      },
    ]);
  };

  const saveRules = async () => {
    await fetch("/app/api/shipping-rules", {
      method: "POST",
      body: JSON.stringify({ rules }),
      headers: { "Content-Type": "application/json" },
    });

    alert("✅ Shipping rules saved");
  };

  if (loading) return <div>Loading shipping rules...</div>;

  return (
    <div style={containerStyle}>
      <h2 style={{ marginBottom: 5 }}>Shipping Rules</h2>
      <p style={{ fontSize: 13, color: "#475569" }}>
        Configure shipping price based on zone and weight range.
      </p>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Zone</th>
            <th style={thStyle}>Min Weight (kg)</th>
            <th style={thStyle}>Max Weight (kg)</th>
            <th style={thStyle}>Price (£)</th>
          </tr>
        </thead>

        <tbody>
          {rules.map((rule, index) => (
            <tr key={index}>
              <td style={tdStyle}>
                <select
                  value={rule.zone_code}
                  onChange={(e) =>
                    updateRule(index, "zone_code", e.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="ZONE_1">ZONE 1 (Mainland)</option>
                  <option value="ZONE_2">ZONE 2 (Highlands)</option>
                  <option value="ZONE_3">ZONE 3 (N. Ireland)</option>
                </select>
              </td>

              <td style={tdStyle}>
                <input
                  type="number"
                  value={rule.min_weight}
                  onChange={(e) =>
                    updateRule(index, "min_weight", Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </td>

              <td style={tdStyle}>
                <input
                  type="number"
                  value={rule.max_weight}
                  onChange={(e) =>
                    updateRule(index, "max_weight", Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </td>

              <td style={tdStyle}>
                <input
                  type="number"
                  value={rule.price}
                  onChange={(e) =>
                    updateRule(index, "price", Number(e.target.value))
                  }
                  style={inputStyle}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 15 }}>
        <button
          onClick={addRow}
          style={{
            ...buttonStyle,
            backgroundColor: "#e2e8f0",
            marginRight: 10,
          }}
        >
          + Add Rule
        </button>

        <button
          onClick={saveRules}
          style={{
            ...buttonStyle,
            backgroundColor: "#2563eb",
            color: "#fff",
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}