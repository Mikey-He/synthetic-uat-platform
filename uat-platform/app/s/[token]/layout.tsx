import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ViewportGate } from "@/components/console/ViewportGate";
import { getParticipantSession } from "@/lib/session";

type Props = { children: ReactNode; params: Promise<{ token: string }> };

export default async function ParticipantLayout({ children, params }: Props) {
  const { token } = await params;
  if (!(await getParticipantSession(token))) notFound();

  return (
    <>
      {children}
      <ViewportGate />
    </>
  );
}
