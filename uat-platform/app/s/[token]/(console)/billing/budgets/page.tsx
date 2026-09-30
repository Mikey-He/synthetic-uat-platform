import Link from "next/link";
import { projectsLabel, triggerLabel } from "@/components/budget/labels";
import { listBudgets } from "@/lib/budgets";
import { budgetAmount } from "@/lib/domain/costs";
import { fixture } from "@/lib/fixtures";
import { formatMoney } from "@/lib/format";
import { getParticipantSession } from "@/lib/session";

type Props = { params: Promise<{ token: string }> };

export default async function BudgetsPage({ params }: Props) {
  const { token } = await params;
  const session = await getParticipantSession(token);
  const budgets = session ? await listBudgets(session.id) : [];

  return (
    <>
      <h1 className="page-title">Budgets &amp; alerts</h1>
      <div className="mt-4">
        <Link href={`/s/${token}/billing/budgets/create`} className="btn-primary">
          Create budget
        </Link>
      </div>
      <table className="data-table mt-4">
        <thead>
          <tr>
            <th>Name</th>
            <th>Scope</th>
            <th>Amount</th>
            <th>Alerts</th>
          </tr>
        </thead>
        <tbody>
          {budgets.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-muted">
                No budgets yet
              </td>
            </tr>
          ) : (
            budgets.map(({ id, config }) => (
              <tr key={id}>
                <td>
                  <Link href={`/s/${token}/billing/budgets/${id}`} className="link">
                    {config.name}
                  </Link>
                </td>
                <td>{projectsLabel(config.scope, fixture.projects)}</td>
                <td>{formatMoney(budgetAmount(fixture, config) ?? 0, fixture.currency)}</td>
                <td>
                  {config.thresholds.map((t) => `${t.percent}% ${triggerLabel(t.trigger)}`).join(", ")}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
