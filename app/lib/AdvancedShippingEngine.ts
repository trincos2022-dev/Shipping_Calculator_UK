import prisma from "../db.server";

interface ShippingItem {
  weight?: number | null;
  source_type?: string | null;
  product_type?: string | null;
}

function parseSourceType(sourceType?: string | null): string {
  const raw = (sourceType ?? "unknown").toString().trim();
  let parsedSource = raw;

  if (raw.includes("(")) {
    const match = raw.match(/\(([^)]+)\)/);
    parsedSource = match?.[1] ?? raw;
  }

  parsedSource = parsedSource.toLowerCase();

  console.log("Source Type Raw:", raw);
  console.log("Parsed Source:", parsedSource);

  return parsedSource || "unknown";
}

export class AdvancedShippingEngine {
  async calculate(items: ShippingItem[], postcode: string): Promise<number> {
    const { zone, prefix } = await this.getZone(postcode);
    const shipments = this.groupBySource(items);

    let totalShipping = 0;
    let totalWeight = 0;

    for (const shipment of shipments) {
      const weight = this.calculateWeight(shipment);
      totalWeight += weight;

      let rate = await this.getRate(zone, weight);

      if (weight > 30) {
        const extraWeight = weight - 30;
        const surcharge = extraWeight * 0.5;

        console.log("🚚 [HEAVY] Extra weight:", extraWeight);
        console.log("🚚 [HEAVY] Surcharge (£0.5/kg):", surcharge);

        rate += surcharge;

        console.log("✅ [FINAL RATE AFTER SURCHARGE]:", rate);
      }

      totalShipping += rate;
    }

    const finalShipping = Math.ceil(totalShipping);
    const parsedSources = Array.from(
      new Set(
        shipments.map((shipment) =>
          parseSourceType(shipment?.[0]?.source_type),
        ),
      ),
    ).filter(Boolean);

    console.log("Final Result:", {
      postcode,
      prefix,
      zone,
      weight: totalWeight,
      price: finalShipping,
      source: parsedSources.join(", "),
    });

    return finalShipping;
  }

  groupBySource(items: ShippingItem[]): ShippingItem[][] {
    const groups: Record<string, ShippingItem[]> = {};

    items.forEach((item) => {
      const key = parseSourceType(item?.source_type);

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(item);
    });

    return Object.values(groups);
  }

  calculateWeight(items: ShippingItem[]): number {
    return items.reduce((sum, item) => {
      const weightVal = Number(item.weight);

      const finalWeight =
        item.weight != null && !isNaN(weightVal) && weightVal > 0
          ? weightVal
          : this.getDefaultWeight(item);

      console.log("⚖️ [WEIGHT RESOLVE]:", {
        originalWeight: item.weight,
        product_type: item.product_type,
        finalWeight,
      });

      return sum + finalWeight;
    }, 0);
  }

  getDefaultWeight(item: ShippingItem): number {
    switch (item.product_type) {
      case "Servers":
        return 20;
      default:
        return 2;
    }
  }

  async getZone(
    postcode: string,
  ): Promise<{ zone: string; prefix: string; number: number }> {
    console.log("Postcode:", postcode);

    try {
      const normalized = postcode?.trim().toUpperCase() ?? "";
      const prefixLetters = normalized.replace(/[^A-Z]/g, "").substring(0, 2);
      const numericMatch = normalized.match(/^[A-Z]{1,2}(\d+)/);
      const number = Number(numericMatch?.[1] ?? 0);

      let zone = "ZONE_1";
      const prefix = prefixLetters;

      if (!prefix) {
        console.log("Prefix:", prefix);
        console.log("Detected Zone (initial):", zone);
        console.log("Fallback applied: ZONE_1");
        return { zone, prefix, number };
      }

      console.log("Prefix:", prefix);

      const zoneMatch = await prisma.shipping_zone_prefixes.findFirst({
        where: { prefix },
      });

      zone = zoneMatch?.zone_code || "ZONE_1";
      console.log("Detected Zone (initial):", zone);
      console.log("Numeric part:", number);

      if (prefix === "PA") {
        zone = number >= 20 ? "ZONE_2" : "ZONE_1";
        console.log("Zone after exception:", zone);
      }

      if (prefix === "PH") {
        zone = number >= 8 ? "ZONE_2" : "ZONE_1";
        console.log("Zone after exception:", zone);
      }

      if (prefix === "FK") {
        zone = "ZONE_1";
        console.log("Zone after exception:", zone);
      }

      return { zone, prefix, number };
    } catch (error) {
      console.log("Fallback applied: ZONE_1", error);
      return { zone: "ZONE_1", prefix: "", number: 0 };
    }
  }

  async getRate(zone: string, weight: number): Promise<number> {
    const weightNum = Number(weight);

    console.log("📦 [RATE] Weight:", weightNum);
    console.log("📍 [ZONE] Zone used:", zone);

    try {
      const rules = await prisma.shipping_rules_UK.findMany({
        where: { zone_code: zone },
        orderBy: [{ min_weight: "asc" }],
      });

      const match = rules.find((rule) => {
        const min = Number(rule.min_weight ?? 0);
        const max = Number(rule.max_weight ?? 0);
        const price = Number(rule.price ?? 0);

        return (
          !isNaN(min) &&
          !isNaN(max) &&
          !isNaN(price) &&
          weightNum >= min &&
          weightNum < max
        );
      });

      if (match) {
        const price = Number(match.price);
        console.log("✅ [MATCH] Price found in table:", price);
        return price;
      }

      // ✅ FIXED: proper fallback for heavy items
      if (weightNum > 30) {
        const lastRule = rules[rules.length - 1]; // highest tier (20–30kg)
        const basePrice = Number(lastRule?.price ?? 0);

        console.log("⚠️ [FALLBACK] Weight exceeds table");
        console.log("📊 Using base tier price (20–30kg):", basePrice);

        return basePrice;
      }

      console.log("⚠️ [FALLBACK] No matching rule. Returning 0");
      return 0;
    } catch (error) {
      console.log("❌ [ERROR] getRate fallback ZONE_1", error);
      return 0;
    }
  }
}