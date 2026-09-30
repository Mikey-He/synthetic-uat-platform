import { notFound } from "next/navigation";
import { SavedBudgetView } from "@/components/budget/SavedBudgetView";
import { getBudget } from "@/lib/budgets";
import { fixture } from "@/lib/fixtures";

type Props = { params: Promise<{ token: string; id: string }> };

export default async function SavedBudgetPage({ params }: Props) {
  const { token, id } = await params;
  const budget = await getBudget(token, id);
  if (!budget) notFound();

  return <SavedBudgetView token={token} budgetId={budget.id} config={budget.config} data={fixture} />;
}
