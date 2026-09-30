"use client";

import Link from "next/link";
import { useId } from "react";
import { Dropdown, Select } from "@/components/console/Dropdown";
import { budgetAmount, type CostData } from "@/lib/domain/costs";
import { emailOptionsEnabled, parseNumber, projectOwnersOffered } from "@/lib/domain/rules";
import type { BudgetConfig } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";
import { Checkbox, FieldError, PreviewTag } from "./fields";
import type { Change } from "./formStore";
import { TRIGGER_OPTIONS } from "./labels";

type Props = {
  token: string;
  config: BudgetConfig;
  percentTexts: string[];
  data: CostData & { currency: string };
  errors: Map<string, string>;
  change: Change;
};

export function ActionsSection({ token, config, percentTexts, data, errors, change }: Props) {
  const percentHeaderId = useId();
  const triggerHeaderId = useId();
  const monitoringGroup = useId();
  const { thresholds, recipients } = config;
  const base = budgetAmount(data, config);
  const emailEnabled = emailOptionsEnabled(config);

  const removeThreshold = (index: number) =>
    change([["thresholds", thresholds.filter((_, i) => i !== index)]], {
      percentTexts: percentTexts.filter((_, i) => i !== index),
    });

  const addThreshold = () =>
    change([["thresholds", [...thresholds, { percent: 100, trigger: "actual" }]]], {
      percentTexts: [...percentTexts, "100"],
    });

  return (
    <>
      <div data-setting="alert">
        <p className="font-medium">Set alert threshold rules</p>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-muted">
              <th id={percentHeaderId} className="py-2 pr-4 font-medium">
                Percent of budget
              </th>
              <th className="py-2 pr-4 font-medium">Amount</th>
              <th id={triggerHeaderId} className="py-2 pr-4 font-medium">
                Trigger on
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {thresholds.map((threshold, index) => {
              const error = errors.get(`thresholds.${index}.percent`);
              return (
                <tr key={index} className="border-b border-line align-top">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-labelledby={percentHeaderId}
                        value={percentTexts[index] ?? ""}
                        onChange={(event) =>
                          change(
                            [[`thresholds.${index}.percent`, parseNumber(event.target.value) ?? Number.NaN]],
                            {
                              percentTexts: percentTexts.map((text, i) =>
                                i === index ? event.target.value : text,
                              ),
                            },
                          )
                        }
                        className={`field w-20 ${error ? "border-error" : ""}`}
                      />
                      <span className="text-muted">%</span>
                    </div>
                    <FieldError message={error} />
                  </td>
                  <td className="py-2 pr-4 leading-9">
                    {base !== undefined && Number.isFinite(threshold.percent)
                      ? formatMoney((base * threshold.percent) / 100, data.currency)
                      : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <Select
                      labelId={triggerHeaderId}
                      value={threshold.trigger}
                      options={TRIGGER_OPTIONS}
                      onChange={(trigger) => change([[`thresholds.${index}.trigger`, trigger]])}
                      className="w-40"
                    />
                  </td>
                  <td className="py-2">
                    {/* TODO: icon-only button; its aria-label is not written in the docs. */}
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={() => removeThreshold(index)}
                      className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface"
                    >
                      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3.5-9h1v8h-1zm4 0h1v8h-1zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" className="btn-secondary mt-3" onClick={addThreshold}>
          Add threshold
        </button>
      </div>

      <div className="mt-6" data-setting="recipients">
        <p className="font-medium">Manage notifications</p>
        {!emailEnabled && <p className="mt-1 text-muted">Add a threshold rule to turn on email alerts.</p>}
        <div className="mt-1.5">
          <Checkbox
            label="Email alerts to billing admins and users"
            checked={recipients.billingAdminsAndUsers}
            disabled={!emailEnabled}
            onChange={(checked) => change([["recipients.billingAdminsAndUsers", checked]])}
          />
          {projectOwnersOffered(config) && (
            <Checkbox
              label={
                <>
                  Email alerts to project owners <PreviewTag />
                </>
              }
              checked={recipients.projectOwners}
              disabled={!emailEnabled}
              onChange={(checked) => change([["recipients.projectOwners", checked]])}
            />
          )}
          <Checkbox
            label="Link Monitoring email notification channels to this budget"
            checked={recipients.monitoring.linked}
            disabled={!emailEnabled}
            onChange={(checked) => change([["recipients.monitoring.linked", checked]])}
          />
          {recipients.monitoring.linked && (
            <div className="mb-2 ml-7 mt-1 space-y-3">
              {data.projects.map((project) => (
                <div key={project.id}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name={monitoringGroup}
                      className="size-4"
                      checked={recipients.monitoring.projectId === project.id}
                      disabled={!emailEnabled}
                      onChange={() => change([["recipients.monitoring.projectId", project.id]])}
                    />
                    {project.name}
                  </label>
                  <div className="ml-7">
                    <p className="text-muted">No notification channels</p>
                    <Link href={`/s/${token}/stub/notification-channels`} className="link">
                      Manage notification channels
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Checkbox
            label="Connect a Pub/Sub topic to this budget"
            checked={recipients.pubsubTopic !== undefined}
            onChange={(checked) => change([["recipients.pubsubTopic", checked ? "" : undefined]])}
          />
          {recipients.pubsubTopic !== undefined && (
            <Dropdown display="No topics available" disabled className="mb-2 ml-7 mt-1 w-72">
              {() => null}
            </Dropdown>
          )}
        </div>
        <FieldError message={errors.get("recipients")} />
      </div>
    </>
  );
}
