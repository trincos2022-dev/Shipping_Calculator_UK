import prisma from "../db.server";

export class AdvancedShippingEngine {

  // ✅ MAIN CALCULATION (NOW ASYNC)
  async calculate(items: any[], postcode: string): Promise<number> {

    const zone = await this.getZone(postcode);
    const shipments = this.groupBySource(items);

    let totalShipping = 0;

    for (const shipment of shipments) {

      const weight = this.calculateWeight(shipment);

      let rate = await this.getRate(zone, weight);

      // ✅ Heavy surcharge safety (>30kg)
      if (weight > 30) {
        rate += (weight - 30) * 0.5;
      }

      totalShipping += rate;
    }

    return Math.ceil(totalShipping);
  }

  // ✅ GROUP BY DISTRIBUTOR (source_type)
  groupBySource(items: any[]) {
    const groups: Record<string, any[]> = {};

    items.forEach(item => {
      const key = item.source_type || "unknown";

      if (!groups[key]) groups[key] = [];

      groups[key].push(item);
    });

    return Object.values(groups);
  }

  // ✅ CALCULATE TOTAL WEIGHT
  calculateWeight(items: any[]): number {
    return items.reduce((sum, item) => {
      return sum + (item.weight || this.getDefaultWeight(item));
    }, 0);
  }

  // ✅ FALLBACK WEIGHT
  getDefaultWeight(item: any): number {
    switch (item.product_type) {
      case "Servers":
        return 20;
      default:
        return 2;
    }
  }

  // ✅ ✅ GET ZONE FROM DB (NEW)
  async getZone(postcode: string): Promise<string> {
    const prefix = postcode
      ?.replace(/[^A-Za-z]/g, "")
      .substring(0, 2)
      .toUpperCase();

    if (!prefix) return "ZONE_1";

    const match = await prisma.shipping_zone_prefixes.findFirst({
      where: { prefix },
    });

    console.log("Shipping zone lookup:", { postcode, prefix, zone: match?.zone_code || "ZONE_1" });

    return match?.zone_code || "ZONE_1"; // default Mainland
  }

  // ✅ ✅ GET RATE FROM DB (NEW)
async getRate(zone: string, weight: number): Promise<number> {

  const weightNum = Number(weight);

  // ✅ Fetch rules
  const rules = await prisma.shipping_rules_UK.findMany({
    where: {
      zone_code: zone
    },
    orderBy: [{ min_weight: "asc" }],
  });

  if (!rules || rules.length === 0) {
    console.log("❌ No rules found for zone:", zone);
    return 0;
  }

  // ✅ Debug
  console.log("Weight:", weightNum);
  console.log("Rules for zone", zone, ":", rules);

  // ✅ FIXED MATCH LOGIC
const match = rules.find(r => {
  const min = Number(r.min_weight ?? 0);
  const max = Number(r.max_weight ?? 0);
  const price = Number(r.price ?? 0);

  // ✅ ignore invalid rows
  if (isNaN(min) || isNaN(max) || isNaN(price)) {
    console.log("⚠️ Invalid rule row:", r);
    return false;
  }

  return weightNum >= min && weightNum <= max;
});

  console.log("Matched rule:", match);

  if (match) {
    return Number(match.price);
  }

  // ✅ fallback
  return 30 + (weightNum - 30);
}
}