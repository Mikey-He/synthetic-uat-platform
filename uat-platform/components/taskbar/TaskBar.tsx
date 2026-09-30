"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TASK_TEXT } from "@/lib/domain/task";
import { useLogger } from "@/lib/events/EventLoggerProvider";

// Fixed heights so screenshots line up across sessions.
export const TASK_BAR_HEIGHT = { expanded: 136, collapsed: 44 } as const;

const PARAGRAPHS = TASK_TEXT.split("\n\n");

type Props = {
  token: string;
  collapsed: boolean;
  onToggle: () => void;
};

export function TaskBar({ token, collapsed, onToggle }: Props) {
  const router = useRouter();
  const logger = useLogger();
  const [finishing, setFinishing] = useState(false);
  const height = collapsed ? TASK_BAR_HEIGHT.collapsed : TASK_BAR_HEIGHT.expanded;

  // I'm finished ends the attempt for both actor types, saved or not. The last
  // events travel with the request that records the end of the session.
  async function finish() {
    if (finishing) return;
    setFinishing(true);
    logger?.log("completion_declared", "I'm finished");
    logger?.log("session_ended", null, { terminationReason: "completion_declared" });
    logger?.stop();
    await logger?.settle();
    await fetch(`/api/s/${token}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: logger?.drain() ?? [] }),
    }).catch(() => undefined);
    router.push(`/s/${token}/done`);
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex items-start gap-4 overflow-hidden border-b border-note-line bg-note px-6 py-3"
      style={{ height }}
    >
      <div className="min-w-0 flex-1">
        {collapsed ? (
          <p className="truncate">{PARAGRAPHS.join(" ")}</p>
        ) : (
          <div className="space-y-2">
            {PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
      {/* TODO: the toggle is icon only, so its aria-label is not written in the docs. Confirm. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand task" : "Collapse task"}
        className="-my-1.5 flex size-8 shrink-0 items-center justify-center rounded text-muted hover:bg-black/5"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path
            d={collapsed ? "M7 10l5 5 5-5" : "M7 14l5-5 5 5"}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button type="button" className="btn-primary -my-2 shrink-0" disabled={finishing} onClick={finish}>
        I&apos;m finished
      </button>
    </div>
  );
}
