import type { MappingRow, ProductRow } from "./types";

interface Props {
  products: ProductRow[];
  mappingRows: MappingRow[];
  onManualSync: () => void;
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

export default function DataTables({ products, mappingRows, 
 //onManualSync 
}: Props) {
  const mappedCount = mappingRows.filter((row) => row.status === "Mapped" || row.status === "Synced").length;
  const lastSynced = mappingRows.reduce((latest, row) => {
    if (row.lastSynced === "—") {
      return latest;
    }
    return latest > row.lastSynced ? latest : row.lastSynced;
  }, "");

  return (
    <section style={panelStyles}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>SKU Data &amp; Mapping</h2>
          <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.6 }}>
            Summary of SKU data and mapping progress. Use manual sync to refresh the mapping table.
          </p>
        </div>

        <button type="button" style={buttonStyles} 
        // onClick={onManualSync}
        >
          Manual sync
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20, marginTop: 16 }}>
        <div>
          <div style={statLabelStyles}>Total SKU records</div>
          <div style={statValueStyles}>{products.length}</div>
        </div>
        <div>
          <div style={statLabelStyles}>Mapped SKUs</div>
          <div style={statValueStyles}>{mappedCount}</div>
        </div>
        <div>
          <div style={statLabelStyles}>Last sync</div>
          <div style={statValueStyles}>{lastSynced || "Not synced yet"}</div>
        </div>
      </div>

      <div style={{ marginTop: 24, color: "#475569", fontSize: 14 }}>
        <strong>Latest mapping status:</strong> {mappingRows.length} entries tracked, {mappedCount} mapped.
      </div>
    </section>
  );
}
