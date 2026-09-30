import { saveBudget } from "@/lib/budgets";
import { validateConfig } from "@/lib/domain/rules";
import { saveBodySchema } from "@/lib/domain/schemas";
import { getParticipantSession } from "@/lib/session";

type Context = { params: Promise<{ token: string }> };

// Saves a budget version. The response carries the budget id only: evaluation
// results never reach a participant.
export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  if (!(await getParticipantSession(token))) return new Response(null, { status: 404 });

  const body = saveBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ issues: [] }, { status: 400 });

  const issues = validateConfig(body.data.config);
  if (issues.length > 0) return Response.json({ issues }, { status: 400 });

  const saved = await saveBudget(token, body.data.config, body.data.editingBudgetId);
  return Response.json({ budgetId: saved.id }, { status: 201 });
}
