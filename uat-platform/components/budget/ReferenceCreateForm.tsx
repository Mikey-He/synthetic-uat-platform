"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { lastMonthSpend } from "@/lib/domain/costs";
import { updateConfig, validateConfig, type ValidationIssue } from "@/lib/domain/rules";
import type { BudgetConfig, Fixture } from "@/lib/domain/types";
import { formatMoney } from "@/lib/format";
import { ActionsSection } from "./ActionsSection";
import { AmountSection } from "./AmountSection";
import { CostTrend } from "./CostTrend";
import { DefineSection } from "./DefineSection";
import {
  createFormStore,
  initialFormState,
  sectionOf,
  type Change,
  type SectionNumber,
} from "./formStore";
import {
  AMOUNT_TYPE_LABELS,
  SECTION_NAMES,
  VALIDATION_MESSAGES,
  periodLabel,
  projectsLabel,
  triggerLabel,
} from "./labels";
import { ScopeSection } from "./ScopeSection";

export type CreateFormData = Pick<
  Fixture,
  "currency" | "today" | "projects" | "folders" | "services" | "labels" | "monthlyCosts"
>;

type Props = {
  token: string;
  data: CreateFormData;
  initialConfig: BudgetConfig;
  editingBudgetId: string | null;
};

const DRAFT_DELAY_MS = 500;

export function ReferenceCreateForm({ token, data, initialConfig, editingBudgetId }: Props) {
  const router = useRouter();
  const [store] = useState(() => createFormStore(initialFormState(initialConfig)));
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftWrite = useRef<Promise<unknown>>(Promise.resolve());
  const saved = useRef(false);
  const listHref = `/s/${token}/billing/budgets`;

  const writeDraft = useCallback(
    (keepalive: boolean) => {
      draftTimer.current = null;
      if (saved.current) return;
      draftWrite.current = fetch(`/api/s/${token}/draft`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: store.get().config, editingBudgetId }),
        keepalive,
      }).catch(() => undefined);
    },
    [store, token, editingBudgetId],
  );

  const flushDraft = useCallback(() => {
    if (draftTimer.current === null) return;
    clearTimeout(draftTimer.current);
    writeDraft(true);
  }, [writeDraft]);

  // Leaving the page, by any route, keeps the draft.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushDraft);
      flushDraft();
    };
  }, [flushDraft]);

  // Every change updates local state at once. The draft follows after 500 ms
  // without further changes.
  const change: Change = (updates, patch = {}) => {
    const current = store.get();
    const result = updateConfig(current.config, updates);
    store.set({ ...current, ...patch, config: result.config });
    if (result.changes.length === 0 && result.cleared.length === 0) return;
    if (draftTimer.current !== null) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => writeDraft(false), DRAFT_DELAY_MS);
  };

  const openSection = (section: SectionNumber) => store.set({ ...store.get(), openSection: section });

  const report = (issues: ValidationIssue[]) =>
    store.set({ ...store.get(), reported: issues, openSection: sectionOf(issues[0].field) });

  async function finish() {
    const issues = validateConfig(store.get().config);
    if (issues.length > 0) {
      report(issues);
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    if (draftTimer.current !== null) {
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
    }
    await draftWrite.current; // an earlier draft write must land before the save clears it
    const response = await fetch(`/api/s/${token}/budgets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: store.get().config, editingBudgetId }),
    }).catch(() => null);

    if (response?.ok) {
      saved.current = true;
      const { budgetId } = (await response.json()) as { budgetId: string };
      router.push(`/s/${token}/billing/budgets/${budgetId}`);
      return;
    }
    setSaving(false);
    if (response?.status === 400) {
      const body = (await response.json().catch(() => null)) as { issues?: ValidationIssue[] } | null;
      if (body?.issues?.length) {
        report(body.issues);
        return;
      }
    }
    setSaveFailed(true);
  }

  const { config } = state;
  // A message from the last Finish stays until its problem is fixed.
  const open = validateConfig(config);
  const errors = new Map(
    state.reported
      .filter((issue) => open.some((o) => o.field === issue.field && o.code === issue.code))
      .map((issue) => [issue.field, VALIDATION_MESSAGES[issue.code]]),
  );

  const target = config.amount.target;
  const summaries: Record<SectionNumber, string> = {
    1: [config.name.trim(), "Alerts only"].filter(Boolean).join(" · "),
    2: [periodLabel(config.period), projectsLabel(config.scope, data.projects)].filter(Boolean).join(" · "),
    3: [
      AMOUNT_TYPE_LABELS[config.amount.type],
      config.amount.type === "last_period"
        ? formatMoney(lastMonthSpend(data, config.scope), data.currency)
        : target !== undefined
          ? formatMoney(target, data.currency)
          : "",
    ]
      .filter(Boolean)
      .join(" · "),
    4: config.thresholds
      .map((t) => `${Number.isFinite(t.percent) ? t.percent : "—"}% ${triggerLabel(t.trigger)}`)
      .join(", "),
  };

  const section = (number: SectionNumber, body: ReactNode) => (
    <FormSection
      number={number}
      summary={summaries[number]}
      open={state.openSection === number}
      onOpen={() => openSection(number)}
      onNext={number < 4 ? () => openSection((number + 1) as SectionNumber) : undefined}
    >
      {body}
    </FormSection>
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href={listHref}
          aria-label="Back"
          className="-ml-2 flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
        </Link>
        <h1 className="page-title">Create budget</h1>
      </div>

      <div className="mt-4 flex items-start gap-8">
        <div className="w-[60%] min-w-0 border-t border-line">
          {section(1, <DefineSection config={config} errors={errors} change={change} />)}
          {section(2, <ScopeSection config={config} data={data} errors={errors} change={change} />)}
          {section(
            3,
            <AmountSection
              config={config}
              targetText={state.targetText}
              data={data}
              errors={errors}
              change={change}
            />,
          )}
          {section(
            4,
            <ActionsSection
              token={token}
              config={config}
              percentTexts={state.percentTexts}
              data={data}
              errors={errors}
              change={change}
            />,
          )}
        </div>
        {/* TODO: where the chart sits at 1440 x 900 with section 4 open is provisional until the capture. */}
        <aside className="min-w-0 flex-1 rounded-lg border border-line px-5 py-4">
          <CostTrend config={config} data={data} />
        </aside>
      </div>

      {/* TODO: Finish and Cancel always visible at the page bottom is provisional until the
          capture confirms it. The prototype wireframe draws Finish inside section 4. */}
      <div className="sticky bottom-0 z-20 -mx-8 mt-8 flex items-center gap-3 border-t border-line bg-white px-8 py-3">
        <button type="button" className="btn-primary" disabled={saving} onClick={finish}>
          Finish
        </button>
        <button type="button" className="btn-secondary" onClick={() => router.push(listHref)}>
          Cancel
        </button>
        {/* TODO: save-failure wording is not written in the docs. Confirm. */}
        {saveFailed && <p className="text-error">The budget could not be saved. Try again.</p>}
      </div>
    </>
  );
}

type FormSectionProps = {
  number: SectionNumber;
  summary: string;
  open: boolean;
  onOpen: () => void;
  onNext?: () => void;
  children: ReactNode;
};

function FormSection({ number, summary, open, onOpen, onNext, children }: FormSectionProps) {
  return (
    <section className="border-b border-line">
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className="flex w-full items-start gap-3 py-4 text-left"
      >
        <span
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium ${
            open ? "bg-primary text-white" : "border border-muted text-muted"
          }`}
        >
          {number}
        </span>
        <span className="min-w-0">
          <span className="block text-[16px] font-medium leading-7">{SECTION_NAMES[number]}</span>
          {!open && summary && <span className="block truncate text-muted">{summary}</span>}
        </span>
      </button>
      {open && (
        <div className="pb-6 pl-9">
          {children}
          {onNext && (
            <button type="button" className="btn-primary mt-6" onClick={onNext}>
              Next
            </button>
          )}
        </div>
      )}
    </section>
  );
}
