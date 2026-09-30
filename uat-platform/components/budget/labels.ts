import type { ValidationCode } from "@/lib/domain/rules";
import type { AmountType, BudgetConfig, Period, Project, Trigger } from "@/lib/domain/types";

// Version A copy. Version B has its own wording for the same settings.

export const SECTION_NAMES = { 1: "Define", 2: "Scope", 3: "Amount", 4: "Actions" } as const;

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom range" },
];

export const TRIGGER_OPTIONS: { value: Trigger; label: string }[] = [
  { value: "actual", label: "Actual" },
  { value: "forecasted", label: "Forecasted" },
];

export const AMOUNT_TYPE_LABELS: Record<AmountType, string> = {
  specified: "Specified amount",
  last_period: "Last month's spend",
};

export const SAVINGS_OPTIONS = [
  { value: "discounts", label: "Discounts" },
  { value: "promotions_and_others", label: "Promotions and others" },
];

export const periodLabel = (period: Period) =>
  PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? period;

export const triggerLabel = (trigger: Trigger) =>
  TRIGGER_OPTIONS.find((option) => option.value === trigger)?.label ?? trigger;

// The closed Projects dropdown: "All projects", or the chosen names.
export function projectsLabel(scope: BudgetConfig["scope"], projects: Project[]) {
  if (scope.allProjects) return "All projects";
  return projects
    .filter((project) => scope.projectIds.includes(project.id))
    .map((project) => project.name)
    .join(", ");
}

export const labelOptionText = (value: string) => value.replace(":", ": ");

export const VALIDATION_MESSAGES: Record<ValidationCode, string> = {
  name_required: "Enter a budget name.", // TODO: provisional until the reference capture
  amount_invalid: "Enter an amount greater than $0.", // TODO: provisional until the reference capture
  project_required: "Select at least one project.", // TODO: provisional until the reference capture
  recipient_required: "Select at least one way to send alerts.", // TODO: provisional until the reference capture
  percent_invalid: "Enter a percent from 1 to 1000.", // TODO: provisional until the reference capture
};
