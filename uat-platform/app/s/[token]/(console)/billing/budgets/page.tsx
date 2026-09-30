import Link from "next/link";

type Props = { params: Promise<{ token: string }> };

export default async function BudgetsPage({ params }: Props) {
  const { token } = await params;
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
          <tr>
            <td colSpan={4} className="text-muted">
              No budgets yet
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
