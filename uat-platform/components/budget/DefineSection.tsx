"use client";

import { useId } from "react";
import type { BudgetConfig } from "@/lib/domain/types";
import { FieldError } from "./fields";
import type { Change } from "./formStore";

type Props = { config: BudgetConfig; errors: Map<string, string>; change: Change };

export function DefineSection({ config, errors, change }: Props) {
  const nameId = useId();
  const error = errors.get("name");
  return (
    <>
      <div data-setting="name">
        <label htmlFor={nameId} className="block font-medium">
          Name
        </label>
        <input
          id={nameId}
          type="text"
          value={config.name}
          onChange={(event) => change([["name", event.target.value]])}
          className={`field mt-1.5 w-96 ${error ? "border-error" : ""}`}
        />
        <FieldError message={error} />
      </div>
      <p className="mt-5">Budget kind · Alerts only</p>
    </>
  );
}
