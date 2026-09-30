import { notFound } from "next/navigation";
import { ReferenceCreateForm } from "@/components/budget/ReferenceCreateForm";
import { getBudget, getDraft, type Draft } from "@/lib/budgets";
import { defaults, fixture } from "@/lib/fixtures";
import { getParticipantSession } from "@/lib/session";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ edit?: string | string[] }>;
};

export default async function CreateBudgetPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { edit } = await searchParams;
  const session = await getParticipantSession(token);
  if (!session) notFound();

  // Edit on a saved budget opens this page with ?edit=<id>. A draft already
  // editing that budget wins, so changes survive a reload.
  const draft = await getDraft(token);
  let start: Draft;
  if (typeof edit === "string") {
    if (draft?.editingBudgetId === edit) start = draft;
    else {
      const budget = await getBudget(token, edit);
      if (!budget) notFound();
      start = { config: budget.config, editingBudgetId: budget.id };
    }
  } else {
    start = draft ?? { config: defaults.config, editingBudgetId: null };
  }

  const data = {
    currency: fixture.currency,
    today: fixture.today,
    projects: fixture.projects,
    folders: fixture.folders,
    services: fixture.services,
    labels: fixture.labels,
    monthlyCosts: fixture.monthlyCosts,
  };

  // The only place in the codebase that reads the variant.
  switch (session.variant) {
    case "A":
      return (
        <ReferenceCreateForm
          key={crypto.randomUUID()} // a fresh form, loaded from the server, on every visit
          token={token}
          data={data}
          initialConfig={start.config}
          editingBudgetId={start.editingBudgetId}
        />
      );
    case "B":
      // TODO: render GuidedSetup from components/variant-b once version B is built.
      notFound();
  }
}
