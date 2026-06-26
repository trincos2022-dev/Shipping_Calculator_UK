import prisma from "../db.server";

// ✅ GET RULES
export async function loader() {
  const rules = await prisma.shipping_rules_UK.findMany({
    orderBy: [{ zone_code: "asc" }, { min_weight: "asc" }],
  });

  const zones = await prisma.shipping_zone_prefixes.findMany();

  return Response.json({ rules, zones });
}

// ✅ SAVE RULES
export async function action({ request }: any) {
  const body = await request.json();
  const { rules } = body;

  // ✅ Clear old rules
  await prisma.shipping_rules_UK.deleteMany();

  // ✅ Insert new rules
  await prisma.shipping_rules_UK.createMany({
    data: rules,
  });

  return Response.json({ success: true });
}