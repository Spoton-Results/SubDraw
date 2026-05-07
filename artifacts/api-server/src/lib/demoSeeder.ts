import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import {
  projectsTable,
  projectMembersTable,
} from "@workspace/db/schema";
import {
  drawScheduleItemsTable,
} from "@workspace/db/schema";
import { gcProjectAssignmentsTable } from "@workspace/db/schema";
import { ownerCoNotificationsTable } from "@workspace/db/schema";
import { planFilesTable, planFileViewsTable } from "@workspace/db/schema";
import { tradeScopesTable } from "@workspace/db/schema";
import {
  subcontractsTable,
  changeOrdersTable,
  invoicesTable,
  activityLogsTable,
  lienWaiversTable,
  subcontractInsurancesTable,
  subcontractCommentsTable,
  subcontractCommentReadsTable,
  contractorLicensesTable,
  submittalsTable,
  submittalMessagesTable,
} from "@workspace/db/schema";
import { hashPassword } from "./auth.js";
import { eq, inArray } from "drizzle-orm";

const DEMO_GC_EMAIL = "demo-gc@subdraw.com";
const DEMO_SUB_EMAIL = "demo-sub@subdraw.com";
const DEMO_SUB2_EMAIL = "demo-sub-plumbing@subdraw.com";
const DEMO_SUB3_EMAIL = "demo-sub-drywall@subdraw.com";

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
    const submittalRows = await db.select({ id: submittalsTable.id }).from(submittalsTable)
      .where(inArray(submittalsTable.subcontractId, scIds));
    if (submittalRows.length > 0) {
      await db.delete(submittalMessagesTable).where(inArray(submittalMessagesTable.submittalId, submittalRows.map(s => s.id)));
    }
    await db.delete(submittalsTable).where(inArray(submittalsTable.subcontractId, scIds));
    await db.delete(lienWaiversTable).where(inArray(lienWaiversTable.subcontractId, scIds));
    await db.delete(activityLogsTable).where(inArray(activityLogsTable.subcontractId, scIds));
    await db.delete(invoicesTable).where(inArray(invoicesTable.subcontractId, scIds));
    await db.delete(changeOrdersTable).where(inArray(changeOrdersTable.subcontractId, scIds));
    await db.delete(subcontractInsurancesTable).where(inArray(subcontractInsurancesTable.subcontractId, scIds));
    await db.delete(subcontractCommentReadsTable).where(inArray(subcontractCommentReadsTable.subcontractId, scIds));
    await db.delete(subcontractCommentsTable).where(inArray(subcontractCommentsTable.subcontractId, scIds));
    await db.delete(contractorLicensesTable).where(inArray(contractorLicensesTable.subcontractId, scIds));
    await db.delete(subcontractsTable).where(inArray(subcontractsTable.id, scIds));
  }

  await db.delete(drawScheduleItemsTable).where(inArray(drawScheduleItemsTable.projectId, projectIds));
  await db.delete(gcProjectAssignmentsTable).where(inArray(gcProjectAssignmentsTable.projectId, projectIds));
  await db.delete(ownerCoNotificationsTable).where(inArray(ownerCoNotificationsTable.projectId, projectIds));
  const planFileRows = await db.select({ id: planFilesTable.id }).from(planFilesTable)
    .where(inArray(planFilesTable.projectId, projectIds));
  if (planFileRows.length > 0) {
    await db.delete(planFileViewsTable).where(inArray(planFileViewsTable.planFileId, planFileRows.map(p => p.id)));
  }
  await db.delete(planFilesTable).where(inArray(planFilesTable.projectId, projectIds));
  await db.delete(tradeScopesTable).where(inArray(tradeScopesTable.projectId, projectIds));
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

  const [scElec] = await db.insert(subcontractsTable).values({ projectId: project.id, subId: sub1.id, baseContractAmount: 45000, tradeCategory: "Electrical", retentionPercentage: 10 }).returning();
  await db.insert(changeOrdersTable).values([
    { subcontractId: scElec.id, description: "Additional panel upgrade for server room", amount: 3500, status: "APPROVED" },
    { subcontractId: scElec.id, description: "Ground fault circuit interrupter installation", amount: 1200, status: "APPROVED" },
    { subcontractId: scElec.id, description: "Conduit rerouting around structural beam", amount: 850, status: "APPROVED" },
  ]);
  const [invElec1] = await db.insert(invoicesTable).values({ subcontractId: scElec.id, invoiceNumber: "E-001", amount: 18000, description: "Rough-in wiring — floors 1–3", status: "PAYMENT_CONFIRMED", retentionAmount: 1800, paymentDate: "2026-02-14", paymentMethod: "ACH", paymentReference: "ACH-20260214-7821", paymentConfirmedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }).returning();
  await db.insert(invoicesTable).values([
    { subcontractId: scElec.id, invoiceNumber: "E-002", amount: 22000, description: "Panel installation and fixture rough-in", status: "APPROVED", retentionAmount: 2200 },
    { subcontractId: scElec.id, invoiceNumber: "E-003", amount: 16000, description: "Final trim-out and testing — all floors", status: "FLAGGED", flaggedOverAmount: 5450, retentionAmount: 1600 },
  ]);
  await db.insert(lienWaiversTable).values({ subcontractId: scElec.id, invoiceId: invElec1.id, projectId: project.id, signedByName: "Marcus Rivera", signedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), invoiceNumber: "E-001", amount: 18000, paymentDate: "2026-02-14", paymentMethod: "ACH", projectName: project.name, projectAddress: project.address ?? undefined, gcCompanyName: gc.companyName, subCompanyName: sub1.companyName });
  await db.insert(subcontractInsurancesTable).values({ subcontractId: scElec.id, insuranceCompany: "Pacific Mutual Insurance", policyNumber: "PMI-2025-48821", expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], generalLiabilityCoverage: 2000000, workersCompCoverage: 1000000 });
  await db.insert(activityLogsTable).values([
    { subcontractId: scElec.id, type: "CONTRACT_CREATED", description: "Subcontract created — $45,000 base", actorName: gc.companyName, actorRole: "GC", createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    { subcontractId: scElec.id, type: "INVOICE_SUBMITTED", description: "Invoice E-001 submitted for $18,000", actorName: sub1.companyName, actorRole: "SUB", createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
    { subcontractId: scElec.id, type: "INVOICE_APPROVED", description: "Invoice E-001 approved", actorName: gc.companyName, actorRole: "GC", createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    { subcontractId: scElec.id, type: "PAYMENT_CONFIRMED", description: "Payment of $16,200 confirmed (retention: $1,800)", actorName: sub1.companyName, actorRole: "SUB", createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000) },
    { subcontractId: scElec.id, type: "INVOICE_FLAGGED", description: "Invoice E-003 flagged — exceeds approved contract total", actorName: gc.companyName, actorRole: "GC", createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
  ]);

  const [scPlumb] = await db.insert(subcontractsTable).values({ projectId: project.id, subId: sub2.id, baseContractAmount: 28000, tradeCategory: "Plumbing", retentionPercentage: 10 }).returning();
  await db.insert(changeOrdersTable).values([
    { subcontractId: scPlumb.id, description: "Fire suppression riser modification", amount: 2100, status: "APPROVED" },
    { subcontractId: scPlumb.id, description: "Under-slab drain relocation", amount: 3800, status: "APPROVED" },
  ]);
  await db.insert(invoicesTable).values([
    { subcontractId: scPlumb.id, invoiceNumber: "P-001", amount: 12000, description: "Rough-in plumbing — all restrooms", status: "PAYMENT_CONFIRMED", retentionAmount: 1200, paymentDate: "2026-02-21", paymentMethod: "Check", paymentReference: "CHK-10042", paymentConfirmedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
    { subcontractId: scPlumb.id, invoiceNumber: "P-002", amount: 15000, description: "Final fixtures and connections", status: "APPROVED", retentionAmount: 1500 },
  ]);
  await db.insert(subcontractInsurancesTable).values({ subcontractId: scPlumb.id, insuranceCompany: "Bay Area Contractors Mutual", policyNumber: "BACM-2025-30047", expirationDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], generalLiabilityCoverage: 1000000, workersCompCoverage: 500000 });
  await db.insert(activityLogsTable).values([
    { subcontractId: scPlumb.id, type: "CONTRACT_CREATED", description: "Subcontract created — $28,000 base", actorName: gc.companyName, actorRole: "GC", createdAt: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000) },
    { subcontractId: scPlumb.id, type: "PAYMENT_CONFIRMED", description: "Payment of $10,800 confirmed (retention: $1,200)", actorName: sub2.companyName, actorRole: "SUB", createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
  ]);

  const [scDry] = await db.insert(subcontractsTable).values({ projectId: project.id, subId: sub3.id, baseContractAmount: 32000, tradeCategory: "Drywall", retentionPercentage: 10 }).returning();
  await db.insert(changeOrdersTable).values([
    { subcontractId: scDry.id, description: "Firewall upgrade per updated code requirements", amount: 1750, status: "APPROVED" },
    { subcontractId: scDry.id, description: "Additional partition walls in lobby", amount: 2200, status: "APPROVED" },
    { subcontractId: scDry.id, description: "Acoustic ceiling tile installation", amount: 1400, status: "APPROVED" },
  ]);
  await db.insert(invoicesTable).values([
    { subcontractId: scDry.id, invoiceNumber: "D-001", amount: 16000, description: "Framing and first-layer drywall", status: "PAYMENT_CONFIRMED", retentionAmount: 1600, paymentDate: "2026-02-28", paymentMethod: "ACH", paymentReference: "ACH-20260228-9034", paymentConfirmedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
    { subcontractId: scDry.id, invoiceNumber: "D-002", amount: 17000, description: "Tape, mud, and finish coat", status: "APPROVED", retentionAmount: 1700 },
  ]);
  const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  await db.insert(subcontractInsurancesTable).values({ subcontractId: scDry.id, insuranceCompany: "Southwest Contractor Risk", policyNumber: "SCR-2025-71190", expirationDate: expiresAt.toISOString().split("T")[0], generalLiabilityCoverage: 1000000, workersCompCoverage: 500000 });
  await db.insert(activityLogsTable).values([
    { subcontractId: scDry.id, type: "CONTRACT_CREATED", description: "Subcontract created — $32,000 base", actorName: gc.companyName, actorRole: "GC", createdAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000) },
    { subcontractId: scDry.id, type: "PAYMENT_CONFIRMED", description: "Payment of $14,400 confirmed (retention: $1,600)", actorName: sub3.companyName, actorRole: "SUB", createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
  ]);

  const [pfArch] = await db.insert(planFilesTable).values({ projectId: project.id, fileName: "Architectural_Floor_Plans_Rev3.pdf", objectPath: "demo/arch-floor-plans-rev3.pdf", fileUrl: null, fileSize: 4817920, description: "Architectural Floor Plans — Rev 3" }).returning();
  const [pfElec] = await db.insert(planFilesTable).values({ projectId: project.id, fileName: "Electrical_One-Line_Diagram.pdf", objectPath: "demo/electrical-one-line.pdf", fileUrl: null, fileSize: 1572864, description: "Electrical One-Line Diagram" }).returning();
  const [pfPlumb] = await db.insert(planFilesTable).values({ projectId: project.id, fileName: "Plumbing_Riser_Diagram.pdf", objectPath: "demo/plumbing-riser.pdf", fileUrl: null, fileSize: 1048576, description: "Plumbing Riser Diagram" }).returning();
  await db.insert(planFileViewsTable).values([
    { planFileId: pfArch.id, subId: sub1.id, subName: "Marcus Rivera", companyName: sub1.companyName, viewedAt: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000) },
    { planFileId: pfArch.id, subId: sub2.id, subName: "Jordan Reyes", companyName: sub2.companyName, viewedAt: new Date(Date.now() - 47 * 24 * 60 * 60 * 1000) },
    { planFileId: pfArch.id, subId: sub3.id, subName: "Casey Nguyen", companyName: sub3.companyName, viewedAt: new Date(Date.now() - 46 * 24 * 60 * 60 * 1000) },
    { planFileId: pfElec.id, subId: sub1.id, subName: "Marcus Rivera", companyName: sub1.companyName, viewedAt: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000) },
    { planFileId: pfPlumb.id, subId: sub2.id, subName: "Jordan Reyes", companyName: sub2.companyName, viewedAt: new Date(Date.now() - 43 * 24 * 60 * 60 * 1000) },
  ]);

  const [submittalElec] = await db.insert(submittalsTable).values({ subcontractId: scElec.id, name: "Panel Specification Sheet", documentPath: "demo/panel-spec-sheet.pdf", documentName: "Panel_Specification_Sheet.pdf", openingMessage: "Please review the attached panel specification sheet for the server room panel upgrade per the approved change order.", requiredResponseDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], acknowledgedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), acknowledgedByName: gc.companyName, acknowledgmentMessage: "Approved. Specifications meet code requirements — proceed with panel installation as submitted." }).returning();
  await db.insert(submittalMessagesTable).values([
    { submittalId: submittalElec.id, senderId: sub1.id, senderName: "Marcus Rivera", senderRole: "SUB", message: "Submitting the panel specification sheet for the server room upgrade. All specs are per the manufacturer's recommendations and comply with NEC 2023.", documentPath: "demo/panel-spec-sheet.pdf", documentName: "Panel_Specification_Sheet.pdf", createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
    { submittalId: submittalElec.id, senderId: gc.id, senderName: gc.companyName, senderRole: "GC", message: "Approved. Specifications meet code requirements — proceed with panel installation as submitted.", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
  ]);

  console.log("[demoSeeder] Demo data seeded for project:", project.id);
}

async function shouldReseed(gcId: string): Promise<boolean> {
  const [latest] = await db.select({ createdAt: projectsTable.createdAt }).from(projectsTable).where(eq(projectsTable.gcId, gcId)).limit(1);
  if (!latest) return true;
  return Date.now() - latest.createdAt.getTime() > DEMO_RESEED_THRESHOLD_MS;
}

async function ensureAndGetAllDemoUsers() {
  const gc = await ensureDemoUser({ email: DEMO_GC_EMAIL, role: "GC", companyName: "Harbor View Construction Co." });
  const sub1 = await ensureDemoUser({ email: DEMO_SUB_EMAIL, role: "SUB", companyName: "Pacific Electric Inc." });
  const sub2 = await ensureDemoUser({ email: DEMO_SUB2_EMAIL, role: "SUB", companyName: "Bay City Plumbing" });
  const sub3 = await ensureDemoUser({ email: DEMO_SUB3_EMAIL, role: "SUB", companyName: "ProDrywall Solutions" });
  return { gc, sub1, sub2, sub3 };
}

export async function resetDemoData() {
  try {
    console.log("[demoSeeder] Ensuring demo accounts...");
    const { gc, sub1, sub2, sub3 } = await ensureAndGetAllDemoUsers();
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

export async function forceResetDemoData() {
  console.log("[demoSeeder] Force reseed — ensuring demo accounts...");
  const { gc, sub1, sub2, sub3 } = await ensureAndGetAllDemoUsers();
  console.log("[demoSeeder] Wiping old demo data...");
  await wipeDemoData(gc.id);
  console.log("[demoSeeder] Seeding fresh demo data...");
  await seedDemoData(gc, sub1, sub2, sub3);
  console.log("[demoSeeder] Force reseed complete.");
}

export function startDemoSeeder() {
  resetDemoData().catch(console.error);
  setInterval(() => {
    resetDemoData().catch(console.error);
  }, DEMO_SEED_INTERVAL_MS);
}
