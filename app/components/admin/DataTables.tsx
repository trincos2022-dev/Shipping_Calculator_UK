import { useFetcher } from "react-router";
import type { MappingRow, ProductRow } from "./types";

interface Props {
  products: ProductRow[];
  mappingRows: MappingRow[];
  productCount: number;
  mappingCount: number;
  latestSyncJob?: {
    id: string;
    status: string;
    processed: number;
    total: number;
    error?: string | null;
    createdAt: string;
    updatedAt: string;
    finishedAt?: string | null;
  } | null;
}

const panelStyles: React.CSSProperties = {
  padding: 20,
  border: "1px solid #d6d8dc",
  borderRadius: 12,
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
  marginTop: 24,
};

const statLabelStyles: React.CSSProperties = {
  fontSize: 14,
  color: "#475569",
  marginBottom: 8,
};

const statValueStyles: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#0f172a",
  marginTop: 4,
};

const buttonStyles: React.CSSProperties = {
  cursor: "pointer",
  padding: "10px 16px",
  borderRadius: 8,
  border: "1px solid #2f6fdb",
  backgroundColor: "#ffffff",
  color: "#2f6fdb",
  fontWeight: 700,
};

export default function DataTables({ products, mappingRows, productCount, mappingCount, latestSyncJob }: Props) {
  const fetcher = useFetcher();
  const isSyncing = fetcher.state === "submitting";

  const lastSynced = mappingRows.length > 0 ?
    mappingRows.reduce((latest, row) => {
      const rowTime = new Date(row.lastSynced).getTime();
      return rowTime > latest ? rowTime : latest;
    }, 0) : null;

  return (
    <section style={panelStyles}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Product Data &amp; Mapping</h2>
          <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.6 }}>
            Summary of product data from source and current mapping status. Use sync to import eligible products into the mapping table.
          </p>
        </div>

        <fetcher.Form method="post">
          <input type="hidden" name="action" value="sync-products" />
          <button type="submit" style={{
            ...buttonStyles,
            opacity: isSyncing ? 0.7 : 1,
            cursor: isSyncing ? "not-allowed" : "pointer",
          }} disabled={isSyncing}>
            {isSyncing ? "Syncing..." : "Sync products"}
          </button>
        </fetcher.Form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20, marginTop: 16 }}>
        <div>
          <div style={statLabelStyles}>Source products</div>
          <div style={statValueStyles}>{productCount}</div>
        </div>
        <div>
          <div style={statLabelStyles}>Mapped products</div>
          <div style={statValueStyles}>{mappingCount}</div>
        </div>
        <div>
          <div style={statLabelStyles}>Last sync</div>
          <div style={statValueStyles}>{lastSynced ? new Date(lastSynced).toLocaleString() : "Not synced yet"}</div>
        </div>
      </div>

      <div style={{ marginTop: 24, color: "#475569", fontSize: 14 }}>
        <strong>Mapping status:</strong> {mappingCount} products mapped from {productCount} eligible source products.
      </div>

      {latestSyncJob ? (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: "#f8fafc", border: "1px solid #cbd5e1" }}>
          <div style={{ marginBottom: 6, fontWeight: 700 }}>Latest sync job</div>
          <div>Status: {latestSyncJob.status}</div>
          <div>Processed: {latestSyncJob.processed}/{latestSyncJob.total}</div>
          <div>Started: {new Date(latestSyncJob.createdAt).toLocaleString()}</div>
          {latestSyncJob.finishedAt ? <div>Finished: {new Date(latestSyncJob.finishedAt).toLocaleString()}</div> : null}
          {latestSyncJob.error ? <div style={{ color: "#b91c1c" }}>Error: {latestSyncJob.error}</div> : null}
        </div>
      ) : (
        <div style={{ marginTop: 16, color: "#475569", fontSize: 14 }}>
          No sync job history found yet.
        </div>
      )}
    </section>
  );
}
