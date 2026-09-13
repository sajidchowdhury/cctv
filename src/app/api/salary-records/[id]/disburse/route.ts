/**
 * POST /api/salary-records/[id]/disburse (doc §4.6)
 *
 * Disburses salary → creates an EXP transaction (account head: Salary)
 * automatically + links transactionId. Marks paidOn = now.
 *
 * If no "Salary" account head exists, creates one (tenant-scoped).
 */
import { NextResponse } from "next/server";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";

export const POST = withTenant(async (user, _req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const record = await db.salaryRecord.findUnique({
    where: { id },
    include: { employee: { select: { name: true } } },
  });
  if (!record) {
    return NextResponse.json({ error: "Salary record not found." }, { status: 404 });
  }
  if (record.paidOn) {
    return NextResponse.json({ error: "Already disbursed." }, { status: 409 });
  }

  const tenantId = user.tenantId!;

  // Find or create the "Salary" account head.
  let salaryHead = await adminDb.accountHead.findFirst({
    where: { tenantId, name: "Salary", kind: "EXP" },
  });
  if (!salaryHead) {
    salaryHead = await adminDb.accountHead.create({
      data: { tenantId, name: "Salary", kind: "EXP" },
    });
  }

  try {
    const result = await adminDb.$transaction(async (tx) => {
      // Create the EXP transaction.
      const txn = await tx.transaction.create({
        data: {
          tenantId,
          type: "EXP",
          partyType: "EMPLOYEE",
          accountHeadId: salaryHead!.id,
          amount: record.netPayable,
          mode: "CASH",
          date: new Date(),
          narration: `Salary: ${record.employee.name} — ${record.month}`,
        },
      });

      // Mark salary record as paid + link transaction.
      const updated = await tx.salaryRecord.update({
        where: { id },
        data: { paidOn: new Date(), transactionId: txn.id },
        select: { id: true, netPayable: true, paidOn: true, transactionId: true },
      });

      return { txn, updated };
    });

    return NextResponse.json({
      ok: true,
      paidOn: result.updated.paidOn,
      transactionId: result.updated.transactionId,
      amount: result.updated.netPayable,
      message: `Salary disbursed: ${formatBDT(result.updated.netPayable)} to ${record.employee.name}.`,
    });
  } catch (err: any) {
    console.error("[salary/disburse] error:", err);
    return NextResponse.json({ error: "Failed to disburse salary." }, { status: 500 });
  }
});

function formatBDT(n: number): string {
  return `\u09F3${n.toFixed(2)}`;
}
