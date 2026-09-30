"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

// Researcher console controls. None of them asks for a name or an email.

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-line p-4">
      <p className="font-medium">Participant link</p>
      <div className="mt-2 flex gap-2">
        <input readOnly value={link} aria-label="Participant link" className="field flex-1" />
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

async function createSession(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Session not created (${response.status}).`);
  return ((await response.json()) as { link: string }).link;
}

function useCreate() {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = (read: (form: FormData) => Record<string, unknown>) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      setLink(await createSession(read(new FormData(event.currentTarget))));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return { link, error, submit };
}

const Select = ({ name, label, options }: { name: string; label: string; options: string[] }) => (
  <label className="block">
    <span className="block font-medium">{label}</span>
    <select name={name} className="field mt-1.5 w-72">
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  </label>
);

const Text = ({ name, label, required = true }: { name: string; label: string; required?: boolean }) => (
  <label className="block">
    <span className="block font-medium">{label}</span>
    <input name={name} required={required} className="field mt-1.5 w-72" />
  </label>
);

export function NewHumanSessionForm() {
  const { link, error, submit } = useCreate();
  return (
    <>
      <form
        className="space-y-4"
        onSubmit={submit((form) => ({
          actorType: "human",
          familiarityBand: form.get("familiarityBand"),
          datasetLabel: form.get("datasetLabel"),
        }))}
      >
        <Select name="familiarityBand" label="Familiarity band" options={["low", "medium", "high"]} />
        <Select name="datasetLabel" label="Dataset label" options={["pilot", "calibration_A", "evaluation_A"]} />
        <div>
          <span className="block font-medium">Variant</span>
          {/* TODO: version B and block assignment within each band come with the version B build. */}
          <p className="mt-1.5">A</p>
        </div>
        <button type="submit" className="btn-primary">
          Create session
        </button>
      </form>
      {error && <p className="mt-4 text-error">{error}</p>}
      {link && <CopyLink link={link} />}
    </>
  );
}

export function NewSyntheticSessionForm() {
  const { link, error, submit } = useCreate();
  return (
    <>
      <form
        className="space-y-4"
        onSubmit={submit((form) => ({
          actorType: "synthetic",
          modelId: form.get("modelId"),
          promptVersion: form.get("promptVersion"),
          personaId: form.get("personaId"),
          calibrationId: (form.get("calibrationId") as string).trim() || null,
        }))}
      >
        <Text name="modelId" label="Model ID" />
        <Text name="promptVersion" label="Prompt version" />
        <Text name="personaId" label="Persona ID" />
        <Text name="calibrationId" label="Calibration ID (optional)" required={false} />
        <div>
          <span className="block font-medium">Dataset label</span>
          <p className="mt-1.5">synthetic</p>
        </div>
        <button type="submit" className="btn-primary">
          Create session
        </button>
      </form>
      {error && <p className="mt-4 text-error">{error}</p>}
      {link && <CopyLink link={link} />}
    </>
  );
}

export function EndSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/admin/sessions/${sessionId}/end`, { method: "POST" });
        router.refresh();
      }}
    >
      End session
    </button>
  );
}

export function RescoreButton() {
  const router = useRouter();
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const response = await fetch("/api/admin/rescore", { method: "POST" });
          const body = (await response.json()) as { sessions: number; evaluatorVersion: string };
          setResult(`Re-scored ${body.sessions} sessions with ${body.evaluatorVersion}.`);
          setBusy(false);
          router.refresh();
        }}
      >
        Re-score
      </button>
      {result && <span className="text-muted">{result}</span>}
    </div>
  );
}
