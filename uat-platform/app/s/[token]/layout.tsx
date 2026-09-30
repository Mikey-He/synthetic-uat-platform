import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { ViewportGate } from "@/components/console/ViewportGate";
import { getParticipantSession } from "@/lib/session";

type Props = { children: ReactNode; params: Promise<{ token: string }> };

export default async function ParticipantLayout({ children, params }: Props) {
  await connection(); // participant pages read live session data, so render per request
  const { token } = await params;
  if (!(await getParticipantSession(token))) notFound();

  return (
    <>
      {children}
      <ViewportGate />
    </>
  );
}
