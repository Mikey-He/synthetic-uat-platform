import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin";
import { createSession } from "@/lib/session";

const newSessionSchema = z.discriminatedUnion("actorType", [
  z.strictObject({
    actorType: z.literal("human"),
    familiarityBand: z.enum(["low", "medium", "high"]),
    datasetLabel: z.enum(["pilot", "calibration_A", "evaluation_A"]),
  }),
  z.strictObject({
    actorType: z.literal("synthetic"),
    modelId: z.string().trim().min(1),
    promptVersion: z.string().trim().min(1),
    personaId: z.string().trim().min(1),
    calibrationId: z.string().trim().min(1).nullable(),
  }),
]);

// Creates a session and returns its link. Humans start at consent, synthetic
// users at the billing overview. No name or email is ever taken.
export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = newSessionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return new Response(null, { status: 400 });

  // TODO: variant is fixed to A until the version B build adds B and block assignment.
  const input = body.data;
  const session =
    input.actorType === "human"
      ? await createSession({ ...input, variant: "A" })
      : await createSession({
          actorType: "synthetic",
          variant: "A",
          agentRun: {
            modelId: input.modelId,
            promptVersion: input.promptVersion,
            personaId: input.personaId,
            calibrationId: input.calibrationId,
          },
        });

  const origin = new URL(request.url).origin;
  const path = input.actorType === "human" ? `/s/${session.token}` : `/s/${session.token}/billing`;
  return Response.json({ id: session.id, token: session.token, link: `${origin}${path}` }, { status: 201 });
}
