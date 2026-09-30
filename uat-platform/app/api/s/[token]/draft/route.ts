import { putDraft } from "@/lib/budgets";
import { draftBodySchema } from "@/lib/domain/schemas";
import { getParticipantSession } from "@/lib/session";

type Context = { params: Promise<{ token: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { token } = await params;
  if (!(await getParticipantSession(token))) return new Response(null, { status: 404 });

  const body = draftBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return new Response(null, { status: 400 });

  await putDraft(token, body.data);
  return new Response(null, { status: 204 });
}
