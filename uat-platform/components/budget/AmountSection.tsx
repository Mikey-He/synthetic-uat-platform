"use client";

import { useId } from "react";
import { lastMonthSpend, type CostData } from "@/lib/domain/costs";
import { parseNumber } from "@/lib/domain/rules";
import type { AmountType, BudgetConfig } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";
import { FieldError } from "./fields";
import type { Change } from "./formStore";
import { AMOUNT_TYPE_LABELS } from "./labels";

type Props = {
  config: BudgetConfig;
  targetText: string;
  data: CostData & { currency: string };
  errors: Map<string, string>;
  change: Change;
};

const AMOUNT_TYPES: AmountType[] = ["specified", "last_period"];

export function AmountSection({ config, targetText, data, errors, change }: Props) {
  const groupName = useId();
  const targetId = useId();
  const error = errors.get("amount.target");

  return (
    <div data-setting="amount">
      <fieldset>
        <legend className="font-medium">Budget type</legend>
        <div className="mt-1.5 space-y-1">
          {AMOUNT_TYPES.map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-3 py-1">
              <input
                type="radio"
                name={groupName}
                className="size-4"
                checked={config.amount.type === type}
                onChange={() => change([["amount.type", type]])}
              />
              {AMOUNT_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        {config.amount.type === "specified" ? (
          <>
            <label htmlFor={targetId} className="block font-medium">
              Target amount
            </label>
            <div
              className={`field mt-1.5 flex w-56 items-center gap-1 px-0 focus-within:border-primary ${
                error ? "border-error" : ""
              }`}
            >
              <span className="pl-3 text-muted">$</span>
              <input
                id={targetId}
                type="text"
                inputMode="decimal"
                value={targetText}
                onChange={(event) =>
                  change([["amount.target", parseNumber(event.target.value)]], {
                    targetText: event.target.value,
                  })
                }
                className="h-full min-w-0 flex-1 bg-transparent pr-3 outline-none"
              />
            </div>
            <FieldError message={error} />
          </>
        ) : (
          <>
            <p className="font-medium">Target amount</p>
            <p className="mt-1.5">{formatMoney(lastMonthSpend(data, config.scope), data.currency)}</p>
          </>
        )}
      </div>
    </div>
  );
}
