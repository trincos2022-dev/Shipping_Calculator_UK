import type { LogRow } from "./types";

interface Props {
  logs: LogRow[];
}

const panelStyles: React.CSSProperties = {
  marginTop: 24,
  padding: 20,
  border: "1px solid #d6d8dc",
  borderRadius: 12,
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
};

const tableStyles: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const headerCellStyles: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  backgroundColor: "#f8fafc",
  fontSize: 14,
  color: "#0f172a",
};

const bodyCellStyles: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 14,
  color: "#334155",
};

function statusLabel(status: "Done" | "Failed") {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    display: "inline-block",
    backgroundColor: status === "Done" ? "#d1fae5" : "#fee2e2",
    color: status === "Done" ? "#065f46" : "#991b1b",
    fontWeight: 700,
    fontSize: 13,
  };
}

export default function LogsPanel({ logs }: Props) {
  return (
    <section style={panelStyles}>
      <h2 style={{ marginTop: 0 }}>Logs</h2>
      <p style={{ color: "#475569", lineHeight: 1.6 }}>
        Review recent webhook and estimate activity, including SKU, price details, and success / failure status.
      </p>

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={headerCellStyles}>SKU</th>
              <th style={headerCellStyles}>Base</th>
              <th style={headerCellStyles}>Tax</th>
              <th style={headerCellStyles}>Carrier</th>
              <th style={headerCellStyles}>Total</th>
              <th style={headerCellStyles}>Status</th>
              <th style={headerCellStyles}>Details</th>
              <th style={headerCellStyles}>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((entry, index) => (
              <tr key={`${entry.sku}-${index}`}>
                <td style={bodyCellStyles}>{entry.sku}</td>
                <td style={bodyCellStyles}>£{entry.basePrice}</td>
                <td style={bodyCellStyles}>£{entry.tax}</td>
                <td style={bodyCellStyles}>£{entry.carrierCharge}</td>
                <td style={bodyCellStyles}>£{entry.total}</td>
                <td style={bodyCellStyles}>
                  <span style={statusLabel(entry.status)}>{entry.status}</span>
                </td>
                <td style={bodyCellStyles}>{entry.note}</td>
                <td style={bodyCellStyles}>{entry.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
