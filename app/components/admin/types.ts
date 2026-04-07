export interface ProductRow {
  sku: string;
  title: string;
  price: string;
  stock: number;
  source: string;
}

export interface MappingRow {
  appSku: string;
  shopifySku: string;
  status: "Mapped" | "Pending" | "Missing" | "Synced";
  lastSynced: string;
  details: string;
}

export interface LogRow {
  sku: string;
  basePrice: string;
  tax: string;
  carrierCharge: string;
  total: string;
  status: "Done" | "Failed";
  note: string;
  timestamp: string;
}

export interface ConnectionInfo {
  connected: boolean;
  callbackUrl: string;
  checkoutCallbackEnabled: boolean;
}

export interface RateSettings {
  taxRate: number;
  carrierCharge: number;
}
