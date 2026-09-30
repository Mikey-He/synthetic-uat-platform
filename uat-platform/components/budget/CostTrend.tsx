"use client";

import { useId } from "react";
import { CostChart, projectColor } from "@/components/console/CostChart";
import { costMonths, projectCost, scopeProjectIds, type CostData } from "@/lib/domain/costs";
import type { BudgetConfig } from "@/lib/domain/types";

type Props = { config: BudgetConfig; data: CostData & { currency: string } };

// Follows the Projects scope live. The fixture has no per-service or per-label
// costs, so the other scope filters cannot change the bars.
export function CostTrend({ config, data }: Props) {
  const titleId = useId();
  const allIds = data.projects.map((project) => project.id);
  const inScope = scopeProjectIds(data, config.scope);
  const months = costMonths(data);

  return (
    <>
      <h2 id={titleId} className="mb-3 font-medium">
        Cost trend
      </h2>
      <CostChart
        titleId={titleId}
        months={months}
        currency={data.currency}
        width={360}
        height={220}
        shortMonths
        series={data.projects
          .filter((project) => inScope.includes(project.id))
          .map((project) => ({
            id: project.id,
            name: project.name,
            color: projectColor(allIds, project.id),
            values: months.map((month) => projectCost(data, project.id, month)),
          }))}
      />
    </>
  );
}
