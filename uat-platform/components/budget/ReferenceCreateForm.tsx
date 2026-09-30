"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { TASK_BAR_HEIGHT } from "@/components/taskbar/TaskBar";
import { lastMonthSpend } from "@/lib/domain/costs";
import { updateConfig, validateConfig, type ValidationIssue } from "@/lib/domain/rules";
import type { BudgetConfig, Fixture } from "@/lib/domain/types";
import { useLogger } from "@/lib/events/EventLoggerProvider";
import { settingOfField, settingValue, type Setting } from "@/lib/events/types";
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
  reopenedBudgetId: string | null; // set when Edit on a saved budget opened the form
};

const DRAFT_DELAY_MS = 500;
const FOOTER_HEIGHT = 64;
const SECTION_KEYS = { 1: "define", 2: "scope", 3: "amount", 4: "actions" } as const;

// How a person came back to a setting. For this long after a section opens, a
// return is credited to what opened it; any other return is a scroll.
type NavCause = "section_header_click" | "next_button" | "validation" | "page_load";
const CAUSE_WINDOW_MS = 1500;

export function ReferenceCreateForm({
  token,
  data,
  initialConfig,
  editingBudgetId,
  reopenedBudgetId,
}: Props) {
  const router = useRouter();
  const logger = useLogger();
  const [store] = useState(() => createFormStore(initialFormState(initialConfig)));
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftWrite = useRef<Promise<unknown>>(Promise.resolve());
  const saved = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const visible = useRef(new Set<Setting>());
  const navCause = useRef<NavCause | null>(null);
  const causeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const listHref = `/s/${token}/billing/budgets`;

  const markCause = useCallback((cause: NavCause) => {
    navCause.current = cause;
    if (causeTimer.current !== null) clearTimeout(causeTimer.current);
    causeTimer.current = setTimeout(() => {
      navCause.current = null;
    }, CAUSE_WINDOW_MS);
  }, []);

  const logStep = useCallback(
    (section: SectionNumber) => {
      if (!logger) return;
      const key = SECTION_KEYS[section];
      const entry = logger.firstTime("step", key) ? "first" : "return";
      logger.log("step_entered", key, { section: key, number: section, entry });
    },
    [logger],
  );

  // ---- draft saving -------------------------------------------------------

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

  // ---- events on arrival --------------------------------------------------

  useEffect(() => {
    if (mounted.current || !logger) return;
    mounted.current = true;
    markCause("page_load");
    if (reopenedBudgetId) logger.log("budget_reopened", reopenedBudgetId, { budgetId: reopenedBudgetId });
    logStep(store.get().openSection);
  }, [logger, logStep, markCause, reopenedBudgetId, store]);

  // setting_reached and setting_returned: which setting controls are on screen.
  // The fixed task bar and the Finish bar are not counted as viewport.
  useEffect(() => {
    const form = root.current;
    if (!logger || !form) return;
    const shown = visible.current;
    const elements = Array.from(form.querySelectorAll<HTMLElement>("[data-setting]"));
    const present = new Set(elements.map((element) => element.dataset.setting as Setting));
    for (const setting of [...shown]) {
      if (!present.has(setting)) {
        shown.delete(setting); // its section closed
        logger.settingLeft(setting);
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const setting = (entry.target as HTMLElement).dataset.setting as Setting;
          if (entry.isIntersecting && !shown.has(setting)) {
            shown.add(setting);
            logger.settingEntered(setting, settingValue(store.get().config, setting), navCause.current ?? "scroll");
          } else if (!entry.isIntersecting && shown.has(setting)) {
            shown.delete(setting);
            logger.settingLeft(setting);
          }
        }
      },
      { rootMargin: `-${TASK_BAR_HEIGHT}px 0px -${FOOTER_HEIGHT}px 0px` },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [logger, store, state.openSection]);

  // Leaving the page takes every setting out of view.
  useEffect(() => {
    const shown = visible.current;
    return () => {
      for (const setting of shown) logger?.settingLeft(setting);
      shown.clear();
    };
  }, [logger]);

  // ---- changes ------------------------------------------------------------

  // Every change updates local state at once, is logged with its old and new
  // value, and reaches the draft after 500 ms without further changes.
  const change: Change = (updates, patch = {}) => {
    const current = store.get();
    const result = updateConfig(current.config, updates);
    store.set({ ...current, ...patch, config: result.config });
    for (const c of result.changes) {
      logger?.log("field_changed", c.path, {
        field: c.path,
        setting: settingOfField(c.path),
        oldValue: c.oldValue ?? null, // an empty optional field is logged as null
        newValue: c.newValue ?? null,
      });
    }
    for (const cleared of result.cleared) {
      logger?.log("option_cleared_by_scope", cleared.option, cleared);
    }
    if (result.changes.length === 0 && result.cleared.length === 0) return;
    if (draftTimer.current !== null) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => writeDraft(false), DRAFT_DELAY_MS);
  };

  const openSection = (section: SectionNumber, cause: NavCause) => {
    const current = store.get();
    if (current.openSection === section) return;
    markCause(cause);
    store.set({ ...current, openSection: section });
    logStep(section);
  };

  // ---- finish ---------------------------------------------------------------

  const showIssues = (issues: ValidationIssue[]) => {
    const shown = issues.map((issue) => ({ field: issue.field, message: VALIDATION_MESSAGES[issue.code] }));
    for (const item of shown) logger?.log("validation_shown", item.field, item);
    logger?.log("save_failed", "Finish", { reason: "validation", issues: shown });
    store.set({ ...store.get(), reported: issues });
    openSection(sectionOf(issues[0].field), "validation");
  };

  async function finish() {
    const config = store.get().config;
    logger?.log("save_clicked", "Finish", { draft: config });
    const issues = validateConfig(config);
    logger?.log("save_attempted", "Finish", {
      valid: issues.length === 0,
      issues: issues.map((issue) => ({ field: issue.field, message: VALIDATION_MESSAGES[issue.code] })),
    });
    if (issues.length > 0) {
      showIssues(issues);
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
      body: JSON.stringify({ config, editingBudgetId }),
    }).catch(() => null);

    if (response?.ok) {
      saved.current = true;
      const { budgetId, version } = (await response.json()) as { budgetId: string; version: number };
      logger?.log("save_succeeded", budgetId, { budgetId, version });
      router.push(`/s/${token}/billing/budgets/${budgetId}`);
      return;
    }
    setSaving(false);
    const body = response
      ? ((await response.json().catch(() => null)) as { issues?: ValidationIssue[] } | null)
      : null;
    if (body?.issues?.length) {
      showIssues(body.issues);
      return;
    }
    logger?.log("save_failed", "Finish", { reason: "server", status: response?.status ?? null });
    setSaveFailed(true);
  }

  // ---- render -------------------------------------------------------------

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
      onOpen={() => openSection(number, "section_header_click")}
      onNext={number < 4 ? () => openSection((number + 1) as SectionNumber, "next_button") : undefined}
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
        <div ref={root} className="w-[60%] min-w-0 border-t border-line">
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
