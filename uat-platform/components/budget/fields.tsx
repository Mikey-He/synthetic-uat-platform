import type { ReactNode } from "react";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[12px] leading-4 text-error">{message}</p>;
}

type CheckboxProps = {
  label: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
};

export function Checkbox({ label, checked, disabled, onChange }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-3 py-1 ${disabled ? "text-muted" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="size-4"
        checked={checked}
        disabled={disabled}
        readOnly={!onChange}
        // No handler when read-only, so the saved budget view can render on the server.
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
      />
      {label}
    </label>
  );
}

export function PreviewTag() {
  return (
    <span className="rounded-full border border-line px-2 text-[12px] leading-5 text-muted">
      Preview
    </span>
  );
}
