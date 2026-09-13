/**
 * POST /api/rma/[id]/transition (doc §5.7)
 *
 * Advances the RMA to a new stage + creates a history entry with notes.
 * Supports skip-stage (with mandatory note). SMS customer on each transition.
 * On DELIVERED_TO_CUSTOMER: closes the RMA + restores inventory unit.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, adminDb } from "@/lib/db";
import { withTenant } from "@/lib/session";
import { getNotifier } from "@/lib/adapters/notifier";

const STAGES = [
  "RECEIVED_FROM_CUSTOMER",
  "SENT_TO_VENDOR",
  "UNDER_REPAIR",
  "RETURNED_FROM_VENDOR",
  "DELIVERED_TO_CUSTOMER",
];

const STAGE_MESSAGES: Record<string, string> = {
  RECEIVED_FROM_CUSTOMER: "Your product has been received for repair.",
  SENT_TO_VENDOR: "Your product has been sent to the vendor for repair.",
  UNDER_REPAIR: "Your product is under repair at the vendor.",
  RETURNED_FROM_VENDOR: "Your product has been returned from the vendor. Ready for pickup.",
  DELIVERED_TO_CUSTOMER: "Your product has been delivered. RMA closed. Thank you.",
};

const TransitionSchema = z.object({
  stage: z.enum([
    "RECEIVED_FROM_CUSTOMER",
    "SENT_TO_VENDOR",
    "UNDER_REPAIR",
    "RETURNED_FROM_VENDOR",
    "DELIVERED_TO_CUSTOMER",
  ]),
  notes: z.string().max(500).optional().nullable(),
  vendorRmaRef: z.string().max(60).optional().nullable(),
  vendorCharge: z.number().min(0).optional(),
  eta: z.string().optional().nullable(),
});

export const POST = withTenant(async (user, req: Request, ctx: any) => {
  const params = ctx?.params ? await ctx.params : {};
  const id = params.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = TransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }
  const { stage, notes, vendorRmaRef, vendorCharge, eta } = parsed.data;

  const ticket = await db.rmaTicket.findUnique({
    where: { id },
    include: { customer: { select: { phone: true, name: true } } },
  });
  if (!ticket || ticket.deletedAt) {
    return NextResponse.json({ error: "RMA not found." }, { status: 404 });
  }
  if (ticket.stage === stage) {
    return NextResponse.json({ error: "Already at this stage." }, { status: 409 });
  }
  if (ticket.stage === "DELIVERED_TO_CUSTOMER") {
    return NextResponse.json({ error: "RMA already closed." }, { status: 409 });
  }

  // Check if skip-stage (jumping ahead more than 1 step).
  const oldIndex = STAGES.indexOf(ticket.stage);
  const newIndex = STAGES.indexOf(stage);
  const isSkip = newIndex > oldIndex + 1;
  if (isSkip && !notes) {
    return NextResponse.json({ error: "Skipping stages requires a note." }, { status: 422 });
  }

  const isFinal = stage === "DELIVERED_TO_CUSTOMER";

  try {
    const result = await adminDb.$transaction(async (tx) => {
      const data: any = {
        stage,
        ...(vendorRmaRef !== undefined ? { vendorRmaRef: vendorRmaRef || null } : {}),
        ...(vendorCharge !== undefined ? { vendorCharge } : {}),
        ...(eta !== undefined ? { eta: eta ? new Date(eta) : null } : {}),
      };
      if (isFinal) data.closedAt = new Date();

      const updated = await tx.rmaTicket.update({
        where: { id },
        data,
      });

      await tx.rmaHistory.create({
        data: {
          rmaTicketId: id,
          stage,
          notes: notes ?? (isSkip ? "Stage skipped" : null),
          actorUserId: user.id,
        },
      });

      // On final delivery: restore inventory unit.
      if (isFinal && ticket.inventoryUnitId) {
        await tx.inventoryUnit.update({
          where: { id: ticket.inventoryUnitId },
          data: { status: "DELIVERED" },
        });
      }

      return updated;
    });

    // SMS customer on each stage transition (doc §5.7).
    if (ticket.customer?.phone) {
      const notifier = getNotifier();
      await notifier.sendSms(
        ticket.customer.phone,
        `${STAGE_MESSAGES[stage] ?? "RMA update."} RMA: ${ticket.rmaNo}.`
      );
    }

    return NextResponse.json({
      ok: true,
      stage: result.stage,
      closedAt: result.closedAt?.toISOString() ?? null,
      message: `RMA advanced to ${stage.replace(/_/g, " ")}.`,
    });
  } catch (err: any) {
    console.error("[rma/transition] error:", err);
    return NextResponse.json({ error: "Failed to transition." }, { status: 500 });
  }
});
