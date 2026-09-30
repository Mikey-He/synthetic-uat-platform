import Link from "next/link";
import type { ReactNode } from "react";
import { budgetAmount, type CostData } from "@/lib/domain/costs";
import { projectOwnersOffered } from "@/lib/domain/rules";
import type { BudgetConfig, Fixture } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";
import { Checkbox, PreviewTag } from "./fields";
import {
  AMOUNT_TYPE_LABELS,
  SAVINGS_OPTIONS,
  SECTION_NAMES,
  labelOptionText,
  periodLabel,
  projectsLabel,
  triggerLabel,
} from "./labels";

type Props = {
  token: string;
  budgetId: string;
  config: BudgetConfig;
  data: CostData & Pick<Fixture, "currency" | "folders">;
};

const orDash = (text: string) => text || "—";

// Every saved value, in the same section order as the create form.
export function SavedBudgetView({ token, budgetId, config, data }: Props) {
  const { scope, amount, thresholds, recipients } = config;
  const base = budgetAmount(data, config) ?? 0;
  const monitoringProject = data.projects.find((p) => p.id === recipients.monitoring.projectId);

  return (
    <>
      <div className="flex items-center gap-4">
        <h1 className="page-title">{config.name}</h1>
        <Link href={`/s/${token}/billing/budgets/create?edit=${budgetId}`} className="btn-secondary">
          Edit
        </Link>
      </div>

      <div className="mt-4 max-w-3xl border-t border-line">
        <Section number={1}>
          <Row label="Name" value={config.name} />
          <p className="py-1">Budget type · Alerts only</p>
        </Section>

        <Section number={2}>
          <Row label="Time range" value={periodLabel(config.period)} />
          {config.period === "custom" && (
            <>
              <Row label="From" value={orDash(config.customRange?.from ?? "")} />
              <Row label="To" value={orDash(config.customRange?.to ?? "")} />
            </>
          )}
          <Row
            label="Folders & organizations"
            value={orDash(
              data.folders
                .filter((f) => scope.filters.folders.includes(f.id))
                .map((f) => f.name)
                .join(", "),
            )}
          />
          <Row label="Projects" value={orDash(projectsLabel(scope, data.projects))} />
          <Row label="Services" value={orDash(scope.filters.services.join(", "))} />
          <Row label="Labels" value={orDash(scope.filters.labels.map(labelOptionText).join(", "))} />
          <Row
            label="Savings"
            value={orDash(
              SAVINGS_OPTIONS.filter((o) => scope.savings.includes(o.value))
                .map((o) => o.label)
                .join(", "),
            )}
          />
          <Checkbox label="Read-only for project users" checked={scope.readOnlyForProjectUsers} disabled />
        </Section>

        <Section number={3}>
          <Row label="Budget type" value={AMOUNT_TYPE_LABELS[amount.type]} />
          <Row label="Target amount" value={formatMoney(base, data.currency)} />
        </Section>

        <Section number={4}>
          <p className="font-medium">Set alert threshold rules</p>
          <table className="data-table mt-2 max-w-xl">
            <thead>
              <tr>
                <th>Percent of budget</th>
                <th>Amount</th>
                <th>Trigger on</th>
              </tr>
            </thead>
            <tbody>
              {thresholds.map((t, index) => (
                <tr key={index}>
                  <td>{t.percent}%</td>
                  <td>{formatMoney((base * t.percent) / 100, data.currency)}</td>
                  <td>{triggerLabel(t.trigger)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 font-medium">Manage notifications</p>
          <Checkbox
            label="Email alerts to billing admins and users"
            checked={recipients.billingAdminsAndUsers}
            disabled
          />
          {projectOwnersOffered(config) && (
            <Checkbox
              label={
                <>
                  Email alerts to project owners <PreviewTag />
                </>
              }
              checked={recipients.projectOwners}
              disabled
            />
          )}
          <Checkbox
            label="Link Monitoring email notification channels to this budget"
            checked={recipients.monitoring.linked}
            disabled
          />
          {recipients.monitoring.linked && monitoringProject && (
            <p className="ml-7 text-muted">{monitoringProject.name}</p>
          )}
          <Checkbox
            label="Connect a Pub/Sub topic to this budget"
            checked={recipients.pubsubTopic !== undefined}
            disabled
          />
        </Section>
      </div>
    </>
  );
}

function Section({ number, children }: { number: 1 | 2 | 3 | 4; children: ReactNode }) {
  return (
    <section className="border-b border-line py-4">
      <h2 className="flex items-center gap-3 text-[16px] font-medium leading-7">
        <span className="flex size-6 items-center justify-center rounded-full border border-muted text-[12px] text-muted">
          {number}
        </span>
        {SECTION_NAMES[number]}
      </h2>
      <div className="mt-2 pl-9">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-4 py-1">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
