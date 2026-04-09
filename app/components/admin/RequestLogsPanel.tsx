import type { RequestLogEntry } from "./types";

interface Props {
  logs: RequestLogEntry[];
}

const panelStyles: React.CSSProperties = {
  padding: 20,
  border: "1px solid #d6d8dc",
  borderRadius: 12,
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
  marginTop: 24,
};

const tableStyles: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const headerCellStyles: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  backgroundColor: "#f8fafc",
  fontSize: 13,
  fontWeight: 600,
  color: "#0f172a",
};

const bodyCellStyles: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#334155",
};

function typeBadge(type: string) {
  const isIncoming = type === "incoming";
  return {
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: isIncoming ? "#dbeafe" : "#fef3c7",
    color: isIncoming ? "#1d4ed8" : "#92400e",
  };
}

function statusBadge(status: number | null) {
  if (!status) return null;
  const isSuccess = status >= 200 && status < 300;
  const isError = status >= 400;
  return {
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: isSuccess ? "#d1fae5" : isError ? "#fee2e2" : "#fef3c7",
    color: isSuccess ? "#065f46" : isError ? "#991b1b" : "#92400e",
  };
}

export default function RequestLogsPanel({ logs }: Props) {
  return (
    <section style={panelStyles}>
      <h2 style={{ marginTop: 0 }}>Request Logs</h2>
      <p style={{ color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
        Track incoming requests from Shopify and outgoing requests from the app. Last 10 requests shown.
      </p>

      {logs.length === 0 ? (
        <div style={{ color: "#64748b", padding: 20, textAlign: "center" }}>
          No requests logged yet. Requests will appear here when Shopify calls the shipping rates endpoint.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyles}>
            <thead>
              <tr>
                <th style={headerCellStyles}>Type</th>
                <th style={headerCellStyles}>Method</th>
                <th style={headerCellStyles}>Endpoint</th>
                <th style={headerCellStyles}>Status</th>
                <th style={headerCellStyles}>Duration</th>
                <th style={headerCellStyles}>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={bodyCellStyles}>
                    <span style={typeBadge(log.type)}>
                      {log.type === "incoming" ? "← Incoming" : "→ Outgoing"}
                    </span>
                  </td>
                  <td style={bodyCellStyles}>
                    <span style={{ 
                      fontWeight: 600,
                      color: log.method === "POST" ? "#7c3aed" : "#059669"
                    }}>
                      {log.method}
                    </span>
                  </td>
                  <td style={bodyCellStyles}>
                    <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {log.endpoint}
                    </span>
                  </td>
                  <td style={bodyCellStyles}>
                    {log.status && <span style={statusBadge(log.status)}>{log.status}</span>}
                    {log.error && (
                      <span style={{ color: "#dc2626", fontSize: 12, marginLeft: 4 }}>
                        {log.error}
                      </span>
                    )}
                  </td>
                  <td style={bodyCellStyles}>
                    {log.durationMs ? `${log.durationMs}ms` : "-"}
                  </td>
                  <td style={bodyCellStyles}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
