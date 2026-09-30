"use client";

import { useId } from "react";
import { MultiSelect, Select } from "@/components/console/Dropdown";
import type { BudgetConfig, Fixture } from "@/lib/domain/types";
import { Checkbox, FieldError } from "./fields";
import type { Change } from "./formStore";
import { PERIOD_OPTIONS, SAVINGS_OPTIONS, labelOptionText, projectsLabel } from "./labels";

type Props = {
  config: BudgetConfig;
  data: Pick<Fixture, "projects" | "folders" | "services" | "labels">;
  errors: Map<string, string>;
  change: Change;
};

// Adds or removes one value, keeping the order of the full option list.
const toggled = (selected: string[], value: string, order: string[]) => {
  const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
  return order.filter((v) => next.includes(v));
};

export function ScopeSection({ config, data, errors, change }: Props) {
  const periodId = useId();
  const foldersId = useId();
  const projectsId = useId();
  const servicesId = useId();
  const labelsId = useId();
  const { scope } = config;
  const projectIds = data.projects.map((project) => project.id);
  const labelValues = data.labels.flatMap((label) => label.values.map((value) => `${label.key}:${value}`));
  const projectsError = errors.get("scope.projectIds");

  // Select all checked means the entire account. Unchecking it clears every
  // project, and the projects checked afterwards become the explicit list.
  const toggleSelectAll = () =>
    change([
      ["scope.allProjects", !scope.allProjects],
      ["scope.projectIds", []],
    ]);

  const toggleProject = (id: string) => {
    const current = scope.allProjects ? projectIds : scope.projectIds;
    change([
      ["scope.allProjects", false],
      ["scope.projectIds", toggled(current, id, projectIds)],
    ]);
  };

  return (
    <div className="space-y-5">
      <div>
        <p id={periodId} className="font-medium">
          Time range
        </p>
        <Select
          labelId={periodId}
          value={config.period}
          options={PERIOD_OPTIONS}
          onChange={(period) => change([["period", period]])}
          className="mt-1.5 w-72"
        />
        {config.period === "custom" && (
          <div className="mt-3 flex gap-4">
            <label className="block">
              <span className="block text-muted">From</span>
              <input
                type="date"
                value={config.customRange?.from ?? ""}
                onChange={(event) => change([["customRange.from", event.target.value]])}
                className="field mt-1 w-44"
              />
            </label>
            <label className="block">
              <span className="block text-muted">To</span>
              <input
                type="date"
                value={config.customRange?.to ?? ""}
                onChange={(event) => change([["customRange.to", event.target.value || undefined]])}
                className="field mt-1 w-44"
              />
            </label>
          </div>
        )}
      </div>

      <div>
        <p id={foldersId} className="font-medium">
          Folders &amp; organizations
        </p>
        <MultiSelect
          labelId={foldersId}
          display={data.folders
            .filter((folder) => scope.filters.folders.includes(folder.id))
            .map((folder) => folder.name)
            .join(", ")}
          options={data.folders.map((folder) => ({ value: folder.id, label: folder.name }))}
          selected={scope.filters.folders}
          onToggle={(id) =>
            change([
              ["scope.filters.folders", toggled(scope.filters.folders, id, data.folders.map((f) => f.id))],
            ])
          }
          emptyText="No folders in this account"
          className="mt-1.5 w-72"
        />
      </div>

      <div>
        <p id={projectsId} className="font-medium">
          Projects
        </p>
        <MultiSelect
          labelId={projectsId}
          display={projectsLabel(scope, data.projects)}
          options={data.projects.map((project) => ({ value: project.id, label: project.name }))}
          selected={scope.allProjects ? projectIds : scope.projectIds}
          onToggle={toggleProject}
          selectAll={{ checked: scope.allProjects, onToggle: toggleSelectAll }}
          invalid={Boolean(projectsError)}
          className="mt-1.5 w-72"
        />
        <FieldError message={projectsError} />
      </div>

      <div>
        <p id={servicesId} className="font-medium">
          Services
        </p>
        <MultiSelect
          labelId={servicesId}
          display={scope.filters.services.join(", ")}
          options={data.services.map((service) => ({ value: service, label: service }))}
          selected={scope.filters.services}
          onToggle={(service) =>
            change([["scope.filters.services", toggled(scope.filters.services, service, data.services)]])
          }
          className="mt-1.5 w-72"
        />
      </div>

      <div>
        <p id={labelsId} className="font-medium">
          Labels
        </p>
        <MultiSelect
          labelId={labelsId}
          display={scope.filters.labels.map(labelOptionText).join(", ")}
          options={labelValues.map((value) => ({ value, label: labelOptionText(value) }))}
          selected={scope.filters.labels}
          onToggle={(value) =>
            change([["scope.filters.labels", toggled(scope.filters.labels, value, labelValues)]])
          }
          className="mt-1.5 w-72"
        />
      </div>

      <fieldset>
        <legend className="font-medium">Savings</legend>
        <div className="mt-1">
          {SAVINGS_OPTIONS.map((option) => (
            <Checkbox
              key={option.value}
              label={option.label}
              checked={scope.savings.includes(option.value)}
              onChange={() =>
                change([
                  [
                    "scope.savings",
                    toggled(scope.savings, option.value, SAVINGS_OPTIONS.map((o) => o.value)),
                  ],
                ])
              }
            />
          ))}
        </div>
      </fieldset>

      <Checkbox
        label="Read-only for project users"
        checked={scope.readOnlyForProjectUsers}
        onChange={(checked) => change([["scope.readOnlyForProjectUsers", checked]])}
      />
    </div>
  );
}
