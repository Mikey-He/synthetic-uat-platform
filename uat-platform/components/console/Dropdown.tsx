"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Dropdowns render their options in the page instead of using a native
// <select>. A native popup is drawn by the browser outside the page, so a
// screenshot-based agent would never see the options.

type DropdownProps = {
  labelId?: string; // id of the visible field label
  display: string; // text on the closed control
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  children: (close: () => void) => ReactNode;
};

export function Dropdown({ labelId, display, disabled, invalid, className = "w-72", children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const buttonId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId ? `${labelId} ${buttonId}` : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded border bg-white px-3 text-left disabled:bg-surface disabled:text-muted ${
          invalid ? "border-error" : "border-line hover:border-muted"
        }`}
      >
        <span className="truncate">{display}</span>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" aria-hidden="true">
          <path d="M7 10l5 5 5-5z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full rounded border border-line bg-white py-1 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

type Option<T extends string> = { value: T; label: string };

type SelectProps<T extends string> = {
  labelId?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export function Select<T extends string>({ labelId, value, options, onChange, className }: SelectProps<T>) {
  const current = options.find((option) => option.value === value);
  return (
    <Dropdown labelId={labelId} display={current?.label ?? ""} className={className}>
      {(close) => (
        <div role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                close();
              }}
              className={`block w-full px-3 py-2 text-left hover:bg-surface ${
                option.value === value ? "bg-selected text-selected-ink" : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

type MultiSelectProps = {
  labelId?: string;
  display: string;
  options: Option<string>[];
  selected: string[];
  onToggle: (value: string) => void;
  selectAll?: { checked: boolean; onToggle: () => void };
  emptyText?: string;
  invalid?: boolean;
  className?: string;
};

export function MultiSelect({
  labelId,
  display,
  options,
  selected,
  onToggle,
  selectAll,
  emptyText,
  invalid,
  className,
}: MultiSelectProps) {
  return (
    <Dropdown labelId={labelId} display={display} invalid={invalid} className={className}>
      {() =>
        options.length === 0 ? (
          <p className="px-3 py-2 text-muted">{emptyText}</p>
        ) : (
          <div role="listbox" aria-multiselectable="true">
            {selectAll && (
              <label className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 hover:bg-surface">
                <input type="checkbox" checked={selectAll.checked} onChange={selectAll.onToggle} />
                Select all
              </label>
            )}
            {options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        )
      }
    </Dropdown>
  );
}
