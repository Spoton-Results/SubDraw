import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import {
  projectsTable,
  projectMembersTable,
} from "@workspace/db/schema";
import {
  subcontractsTable,
  changeOrdersTable,
  invoicesTable,
  activityLogsTable,
  lienWaiversTable,
  subcontractInsurancesTable,
} from "@workspace/db/schema";
import { hashPassword } from "./auth.js";
import { eq, inArray } from "drizzle-orm";

const DEMO_GC_EMAIL = "demo-gc@subtracker.com";
const DEMO_SUB_EMAIL = "demo-sub@subtracker.com";
const DEMO_SUB2_EMAIL = "demo-sub-plumbing@subtracker.com";
const DEMO_SUB3_EMAIL = "demo-sub-drywall@subtracker.com";

const DEMO_SEED_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEMO_RESEED_THRESHOLD_MS = 23 * 60 * 60 * 1000;

async function ensureDemoUser(opts: {
  email: string;
  role: "GC" | "SUB";
  companyName: string;
}) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, opts.email))
    .limit(1);
  if (existing) return existing;

  const pw = await hashPassword(crypto.randomBytes(32).toString("hex"));
  const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: opts.email,
      passwordHash: pw,
      role: opts.role,
      companyName: opts.companyName,
      isDemo: true,
      trialStartedAt: farFuture,
    })
    .returning();
  return user;
}

async function wipeDemoData(gcId: string) {
  const projects = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.gcId, gcId));

  if (projects.length === 0) return;
  const projectIds = projects.map((p) => p.id);

  const scs = await db
    .select({ id: subcontractsTable.id })
    .from(subcontractsTable)
    .where(inArray(subcontractsTable.projectId, projectIds));

  if (scs.length > 0) {
    const scIds = scs.map((s) => s.id);
    await db.delete(lienWaiversTable).where(inArray(lienWaiversTable.subcontractId, scIds));
    await db.delete(activityLogsTable).where(inArray(activityLogsTable.subcontractId, scIds));
    await db.delete(invoicesTable).where(inArray(invoicesTable.subcontractId, scIds));
    await db.delete(changeOrdersTable).where(inArray(changeOrdersTable.subcontractId, scIds));
    await db.delete(subcontractInsurancesTable).where(inArray(subcontractInsurancesTable.subcontractId, scIds));
    await db.delete(subcontractsTable).where(inArray(subcontractsTable.id, scIds));
  }

  await db.delete(projectMembersTable).where(inArray(projectMembersTable.projectId, projectIds));
  await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds));
}

async function seedDemoData(
  gc: { id: string; companyName: string },
  sub1: { id: string; companyName: string },
  sub2: { id: string; companyName: string },
  sub3: { id: string; companyName: string }
) {
  const [project] = await db
    .insert(projectsTable)
    .values({
      name: "Harbor View Office Renovation",
      gcId: gc.id,
      status: "CONSTRUCTION",
      address: "1420 Harbor Blvd Suite 300",
      description:
        "Complete interior renovation of 12,000 sq ft commercial office space including electrical, plumbing, drywall, and HVAC systems.",
    })
    .returning();

  await db.insert(projectMembersTable).values([
    { projectId: project.id, userId: sub1.id, roleOnProject: "SUB" },
    { projectId: project.id, userId: sub2.id, roleOnProject: "SUB" },
    { projectId: project.id, userId: sub3.id, roleOnProject: "SUB" },
  ]);

  // ── Electrical subcontract (sub1 = demo-sub@) ────────────────────────────
  const [scElec] = await db
    .insert(subcontractsTable)
    .values({
      projectId: project.id,
      subId: sub1.id,
      baseContractAmount: 45000,
      tradeCategory: "Electrical",
      retentionPercentage: 10,
    })
    .returning();

  await db.insert(changeOrdersTable).values([
    {
      subcontractId: scElec.id,
      description: "Additional panel upgrade for server room",
      amount: 3500,
      status: "APPROVED",
    },
    {
      subcontractId: scElec.id,
      description: "Ground fault circuit interrupter installation",
      amount: 1200,
      status: "APPROVED",
    },
    {
      subcontractId: scElec.id,
      description: "Conduit rerouting around structural beam",
      amount: 850,
      status: "APPROVED",
    },
  ]);

  const [invElec1] = await db
    .insert(invoicesTable)
    .values({
      subcontractId: scElec.id,
      invoiceNumber: "E-001",
      amount: 18000,
      description: "Rough-in wiring — floors 1–3",
      status: "PAYMENT_CONFIRMED",
      retentionAmount: 1800,
      paymentDate: "2026-02-14",
      paymentMethod: "ACH",
      paymentReference: "ACH-20260214-7821",
      paymentConfirmedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .returning();

  await db.insert(invoicesTable).values([
    {
      subcontractId: scElec.id,
      invoiceNumber: "E-002",
      amount: 22000,
      description: "Panel installation and fixture rough-in",
      status: "APPROVED",
      retentionAmount: 2200,
    },
    {
      subcontractId: scElec.id,
      invoiceNumber: "E-003",
      amount: 16000,
      description: "Final trim-out and testing — all floors",
      status: "FLAGGED",
      flaggedOverAmount: 5450,
      retentionAmount: 1600,
    },
  ]);

  await db.insert(lienWaiversTable).values({
    subcontractId: scElec.id,
    invoiceId: invElec1.id,
    projectId: project.id,
    signedByName: "Marcus Rivera",
    signedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
    invoiceNumber: "E-001",
    amount: 18000,
    paymentDate: "2026-02-14",
    paymentMethod: "ACH",
    projectName: project.name,
    projectAddress: project.address ?? undefined,
    gcCompanyName: gc.companyName,
    subCompanyName: sub1.companyName,
  });

  await db.insert(subcontractInsurancesTable).values({
    subcontractId: scElec.id,
    insuranceCompany: "Pacific Mutual Insurance",
    policyNumber: "PMI-2025-48821",
    expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    generalLiabilityCoverage: 2000000,
    workersCompCoverage: 1000000,
  });

  await db.insert(activityLogsTable).values([
    {
      subcontractId: scElec.id,
      type: "CONTRACT_CREATED",
      description: "Subcontract created — $45,000 base",
      actorName: gc.companyName,
      actorRole: "GC",
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
    {
      subcontractId: scElec.id,
      type: "INVOICE_SUBMITTED",
      description: "Invoice E-001 submitted for $18,000",
      actorName: sub1.companyName,
      actorRole: "SUB",
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    },
    {
      subcontractId: scElec.id,
      type: "INVOICE_APPROVED",
      description: "Invoice E-001 approved",
      actorName: gc.companyName,
      actorRole: "GC",
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    },
    {
      subcontractId: scElec.id,
      type: "PAYMENT_CONFIRMED",
      description: "Payment of $16,200 confirmed (retention: $1,800)",
      actorName: sub1.companyName,
      actorRole: "SUB",
      createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
    },
    {
      subcontractId: scElec.id,
      type: "INVOICE_FLAGGED",
      description: "Invoice E-003 flagged — exceeds approved contract total",
      actorName: gc.companyName,
      actorRole: "GC",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  ]);

  // ── Plumbing subcontract (sub2) ───────────────────────────────────────────
  const [scPlumb] = await db
    .insert(subcontractsTable)
    .values({
      projectId: project.id,
      subId: sub2.id,
      baseContractAmount: 28000,
      tradeCategory: "Plumbing",
      retentionPercentage: 10,
    })
    .returning();

  await db.insert(changeOrdersTable).values([
    {
      subcontractId: scPlumb.id,
      description: "Fire suppression riser modification",
      amount: 2100,
      status: "APPROVED",
    },
    {
      subcontractId: scPlumb.id,
      description: "Under-slab drain relocation",
      amount: 3800,
      status: "APPROVED",
    },
  ]);

  await db.insert(invoicesTable).values([
    {
      subcontractId: scPlumb.id,
      invoiceNumber: "P-001",
      amount: 12000,
      description: "Rough-in plumbing — all restrooms",
      status: "PAYMENT_CONFIRMED",
      retentionAmount: 1200,
      paymentDate: "2026-02-21",
      paymentMethod: "Check",
      paymentReference: "CHK-10042",
      paymentConfirmedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      subcontractId: scPlumb.id,
      invoiceNumber: "P-002",
      amount: 15000,
      description: "Final fixtures and connections",
      status: "APPROVED",
      retentionAmount: 1500,
    },
  ]);

  await db.insert(subcontractInsurancesTable).values({
    subcontractId: scPlumb.id,
    insuranceCompany: "Bay Area Contractors Mutual",
    policyNumber: "BACM-2025-30047",
    expirationDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    generalLiabilityCoverage: 1000000,
    workersCompCoverage: 500000,
  });

  await db.insert(activityLogsTable).values([
    {
      subcontractId: scPlumb.id,
      type: "CONTRACT_CREATED",
      description: "Subcontract created — $28,000 base",
      actorName: gc.companyName,
      actorRole: "GC",
      createdAt: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000),
    },
    {
      subcontractId: scPlumb.id,
      type: "PAYMENT_CONFIRMED",
      description: "Payment of $10,800 confirmed (retention: $1,200)",
      actorName: sub2.companyName,
      actorRole: "SUB",
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    },
  ]);

  // ── Drywall subcontract (sub3) — insurance expiring in 15 days ───────────
  const [scDry] = await db
    .insert(subcontractsTable)
    .values({
      projectId: project.id,
      subId: sub3.id,
      baseContractAmount: 32000,
      tradeCategory: "Drywall",
      retentionPercentage: 10,
    })
    .returning();

  await db.insert(changeOrdersTable).values([
    {
      subcontractId: scDry.id,
      description: "Firewall upgrade per updated code requirements",
      amount: 1750,
      status: "APPROVED",
    },
    {
      subcontractId: scDry.id,
      description: "Additional partition walls in lobby",
      amount: 2200,
      status: "APPROVED",
    },
    {
      subcontractId: scDry.id,
      description: "Acoustic ceiling tile installation",
      amount: 1400,
      status: "APPROVED",
    },
  ]);

  await db.insert(invoicesTable).values([
    {
      subcontractId: scDry.id,
      invoiceNumber: "D-001",
      amount: 16000,
      description: "Framing and first-layer drywall",
      status: "PAYMENT_CONFIRMED",
      retentionAmount: 1600,
      paymentDate: "2026-02-28",
      paymentMethod: "ACH",
      paymentReference: "ACH-20260228-9034",
      paymentConfirmedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      subcontractId: scDry.id,
      invoiceNumber: "D-002",
      amount: 17000,
      description: "Tape, mud, and finish coat",
      status: "APPROVED",
      retentionAmount: 1700,
    },
  ]);

  // Insurance expiring in 15 days — triggers "Expiring Soon" yellow badge
  const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  await db.insert(subcontractInsurancesTable).values({
    subcontractId: scDry.id,
    insuranceCompany: "Southwest Contractor Risk",
    policyNumber: "SCR-2025-71190",
    expirationDate: expiresAt.toISOString().split("T")[0],
    generalLiabilityCoverage: 1000000,
    workersCompCoverage: 500000,
  });

  await db.insert(activityLogsTable).values([
    {
      subcontractId: scDry.id,
      type: "CONTRACT_CREATED",
      description: "Subcontract created — $32,000 base",
      actorName: gc.companyName,
      actorRole: "GC",
      createdAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
    },
    {
      subcontractId: scDry.id,
      type: "PAYMENT_CONFIRMED",
      description: "Payment of $14,400 confirmed (retention: $1,600)",
      actorName: sub3.companyName,
      actorRole: "SUB",
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log("[demoSeeder] Demo data seeded for project:", project.id);
}

async function shouldReseed(gcId: string): Promise<boolean> {
  const [latest] = await db
    .select({ createdAt: projectsTable.createdAt })
    .from(projectsTable)
    .where(eq(projectsTable.gcId, gcId))
    .limit(1);

  if (!latest) return true;
  return Date.now() - latest.createdAt.getTime() > DEMO_RESEED_THRESHOLD_MS;
}

export async function resetDemoData() {
  try {
    console.log("[demoSeeder] Ensuring demo accounts...");
    const gc = await ensureDemoUser({
      email: DEMO_GC_EMAIL,
      role: "GC",
      companyName: "Harbor View Construction Co.",
    });
    const sub1 = await ensureDemoUser({
      email: DEMO_SUB_EMAIL,
      role: "SUB",
      companyName: "Pacific Electric Inc.",
    });
    const sub2 = await ensureDemoUser({
      email: DEMO_SUB2_EMAIL,
      role: "SUB",
      companyName: "Bay City Plumbing",
    });
    const sub3 = await ensureDemoUser({
      email: DEMO_SUB3_EMAIL,
      role: "SUB",
      companyName: "ProDrywall Solutions",
    });

    if (!(await shouldReseed(gc.id))) {
      console.log("[demoSeeder] Demo data is fresh — skipping reseed");
      return;
    }

    console.log("[demoSeeder] Wiping old demo data...");
    await wipeDemoData(gc.id);

    console.log("[demoSeeder] Seeding fresh demo data...");
    await seedDemoData(gc, sub1, sub2, sub3);
    console.log("[demoSeeder] Done.");
  } catch (err: any) {
    console.error("[demoSeeder] Error:", err.message);
  }
}

export function startDemoSeeder() {
  resetDemoData().catch(console.error);
  setInterval(() => {
    resetDemoData().catch(console.error);
  }, DEMO_SEED_INTERVAL_MS);
}
