import { isAdmin, unauthorized } from "@/lib/admin";
import { abandonSession } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

// End session: for a session the participant left. Recorded as abandoned.
export async function POST(_request: Request, { params }: Context) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  const ended = await abandonSession(id).catch(() => null);
  if (ended === null) return new Response(null, { status: 404 });
  return new Response(null, { status: ended ? 204 : 409 });
}
