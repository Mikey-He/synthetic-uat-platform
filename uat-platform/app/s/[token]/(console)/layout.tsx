import type { ReactNode } from "react";
import { ParticipantShell } from "@/components/console/ParticipantShell";
import { fixture } from "@/lib/fixtures";

type Props = { children: ReactNode; params: Promise<{ token: string }> };

export default async function ConsoleLayout({ children, params }: Props) {
  const { token } = await params;
  const you = fixture.billingMembers.find((member) => member.isYou);

  return (
    <ParticipantShell
      token={token}
      accountName={fixture.billingAccount.name}
      userName={you?.name ?? ""}
    >
      {children}
    </ParticipantShell>
  );
}
