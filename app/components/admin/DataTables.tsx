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
    createdAt: string | Date;
    updatedAt: string | Date;
    finishedAt?: string | Date | null;
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
  const currentAction = fetcher.formData?.get("action") as string | null;
  const isSyncing = currentAction === "sync-products" && fetcher.state === "submitting";
  const isCancelling = currentAction === "cancel-sync" && fetcher.state === "submitting";
  const isResuming = currentAction === "resume-sync" && fetcher.state === "submitting";
  const isManualSync = currentAction === "manual-sync" && fetcher.state === "submitting";

  const lastSynced = mappingRows.length > 0 ?
    mappingRows.reduce((latest, row) => {
      const rowTime = new Date(row.lastSynced).getTime();
      return rowTime > latest ? rowTime : latest;
    }, 0) : null;

  const jobButtonLabel = latestSyncJob?.status === "running"
    ? isCancelling ? "Cancelling..." : "Cancel sync"
    : latestSyncJob?.status === "cancelled" || latestSyncJob?.status === "failed"
    ? isResuming ? "Resuming..." : "Resume sync"
    : isSyncing ? "Syncing..." : "Sync products";

  const jobFormAction = latestSyncJob?.status === "running"
    ? "cancel-sync"
    : latestSyncJob?.status === "cancelled" || latestSyncJob?.status === "failed"
    ? "resume-sync"
    : "sync-products";

  const manualButtonLabel = isManualSync ? "Manual syncing..." : "Manual Sync";
  const buttonDisabled = isSyncing || isCancelling || isResuming || isManualSync;

  const progressPercent = latestSyncJob && latestSyncJob.total > 0
    ? Math.round((latestSyncJob.processed / latestSyncJob.total) * 100)
    : 0;

  return (
    <section style={panelStyles}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Product Data &amp; Mapping</h2>
          <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.6 }}>
            Summary of product data from source and current mapping status. Use sync to import eligible products into the mapping table.
          </p>
        </div>
        <fetcher.Form method="post" style={{ marginLeft: "auto" }}>
          <input type="hidden" name="action" value="manual-sync" />
          <button type="submit" style={{
            ...buttonStyles,
            backgroundColor: "#2563eb",
            color: "#ffffff",
            borderColor: "#2563eb",
            opacity: buttonDisabled ? 0.7 : 1,
            cursor: buttonDisabled ? "not-allowed" : "pointer",
          }} disabled={buttonDisabled}>
            {manualButtonLabel}
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
          <div style={{ marginTop: 10, width: "100%" }}>
            <div style={{
              width: "100%",
              height: 14,
              backgroundColor: "#e2e8f0",
              borderRadius: 9999,
              overflow: "hidden",
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: "100%",
                backgroundColor: latestSyncJob.status === "completed" ? "#22c55e" : "#2563eb",
                transition: "width 0.3s ease",
              }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: "#475569" }}>
              {progressPercent}% complete
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div>Started: {new Date(latestSyncJob.createdAt).toLocaleString()}</div>
              {latestSyncJob.finishedAt ? <div>Finished: {new Date(latestSyncJob.finishedAt).toLocaleString()}</div> : null}
              {latestSyncJob.error ? <div style={{ color: "#b91c1c", marginTop: 6 }}>Error: {latestSyncJob.error}</div> : null}
            </div>
            <fetcher.Form method="post" style={{ marginLeft: "auto" }}>
              <input type="hidden" name="action" value={jobFormAction} />
              {latestSyncJob?.id ? <input type="hidden" name="jobId" value={latestSyncJob.id} /> : null}
              <button type="submit" style={{
                ...buttonStyles,
                opacity: buttonDisabled ? 0.7 : 1,
                cursor: buttonDisabled ? "not-allowed" : "pointer",
              }} disabled={buttonDisabled}>
                {jobButtonLabel}
              </button>
            </fetcher.Form>
          </div>
          {latestSyncJob.finishedAt ? <div>Finished: {new Date(latestSyncJob.finishedAt).toLocaleString()}</div> : null}
          {latestSyncJob.error ? <div style={{ color: "#b91c1c" }}>Error: {latestSyncJob.error}</div> : null}
        </div>
      ) : (
        <div style={{ marginTop: 16, color: "#475569", fontSize: 14 }}>
          <div>No sync job history found yet.</div>
        </div>
      )}
    </section>
  );
}
