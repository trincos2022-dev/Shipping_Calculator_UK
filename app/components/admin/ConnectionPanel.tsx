import type { ConnectionInfo } from "./types";

interface Props {
  connection: ConnectionInfo;
  onToggleConnection: (connected: boolean) => void;
}

const panelStyles: React.CSSProperties = {
  padding: 16,
  border: "1px solid #d6d8dc",
  borderRadius: 12,
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
};

export default function ConnectionPanel({ connection, onToggleConnection }: Props) {
  const buttonStyles: React.CSSProperties = {
    cursor: "pointer",
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    backgroundColor: connection.connected ? "#ef4444" : "#2f6fdb",
    color: "#ffffff",
    fontWeight: 700,
  };

  return (
    <section style={panelStyles}>
      <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>Shopify Callback Connection</h2>
      <p style={{ color: "#475569", lineHeight: 1.5, margin: 0, marginBottom: 16 }}>
        The callback URL is managed by the app environment and cannot be changed here. Use the button below to connect or disconnect the webhook.
      </p>

      <div style={{ marginBottom: 16, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
        <div style={{ marginBottom: 10 }}>
          <strong>Callback URL</strong>
          <div style={{ marginTop: 8, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, backgroundColor: "#f8fafc", wordBreak: "break-all" }}>
            {connection.callbackUrl || "Not configured in environment"}
          </div>
        </div>
        <div>
          <strong>Status:</strong> {connection.connected ? "Connected" : "Not connected"}
        </div>
      </div>

      <button type="button" style={buttonStyles} onClick={() => onToggleConnection(!connection.connected)}>
        {connection.connected ? "Disconnect" : "Connect"}
      </button>
    </section>
  );
}
