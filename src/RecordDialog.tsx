import { useEffect, useRef, useState, type ReactNode } from "react";
import { type TabSpec, type FieldKind } from "./schema";
import { parseSheetDate, toISO } from "./dates";

export interface DialogState {
  /** New for every opening, so the form starts fresh each time. */
  id: number;
  spec: TabSpec;
  headers: string[];
  values: Record<string, string>;
  rowNumber?: number; // set when editing an existing row
  title: string;
  saveLabel: string;
  /** For "Mark as applied": the saved row to delete after the application is added. */
  fromSavedRow?: number;
}

interface Props {
  state: DialogState | null;
  onClose: () => void;
  onSave: (state: DialogState, values: Record<string, string>) => Promise<void>;
  onDelete: (state: DialogState) => Promise<void>;
  onMarkApplied: (state: DialogState) => void;
}

const kindOf = (spec: TabSpec, header: string): FieldKind => spec.kinds[header] ?? "text";

/** Form values: dates become ISO for the date picker. */
function toForm(spec: TabSpec, headers: string[], values: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const h of headers) {
    const v = values[h] ?? "";
    const date = kindOf(spec, h) === "date" ? parseSheetDate(v) : null;
    out[h] = date ? toISO(date) : v;
  }
  return out;
}

/** The native <dialog> element: opening and closing it is the only side effect. */
export function RecordDialog({ state, onClose, ...actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (state && !dialog.open) dialog.showModal();
    if (!state && dialog.open) dialog.close();
  }, [state]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="dialog-title">
      {state && <DialogForm key={state.id} state={state} onClose={onClose} {...actions} />}
    </dialog>
  );
}

function DialogForm({ state, onClose, onSave, onDelete, onMarkApplied }: Props & { state: DialogState }) {
  const { spec, headers } = state;
  const [values, setValues] = useState(() => toForm(spec, headers, state.values));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const field = (h: string) => {
    const kind = kindOf(spec, h);
    const id = `f-${h.replace(/\W+/g, "-")}`;
    const set = (v: string) => setValues((cur) => ({ ...cur, [h]: v }));
    const value = values[h] ?? "";
    let input: ReactNode;
    if (kind === "status" && spec.statuses) {
      const options = value && !spec.statuses.includes(value) ? [value, ...spec.statuses] : spec.statuses;
      input = (
        <select id={id} value={value} onChange={(e) => set(e.target.value)}>
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    } else if (kind === "long") {
      input = <textarea id={id} rows={3} value={value} onChange={(e) => set(e.target.value)} />;
    } else {
      const type = kind === "date" ? "date" : kind === "url" ? "url" : "text";
      input = <input id={id} type={type} value={value} onChange={(e) => set(e.target.value)} />;
    }
    return (
      <div key={h} className={`field${kind === "long" ? " wide" : ""}`}>
        <label htmlFor={id}>{h}</label>
        {input}
      </div>
    );
  };

  return (
    <form
      method="dialog"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => onSave(state, values));
      }}
    >
      <header className="dialog-head">
        <h2 id="dialog-title">{state.title}</h2>
        <button type="button" className="icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="fields">{headers.map(field)}</div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer className="dialog-foot">
        {state.rowNumber !== undefined && (
          <button
            type="button"
            className="button danger"
            disabled={busy}
            onClick={() => {
              if (confirm(`Delete this ${spec.singular} from your Google Sheet?`)) void run(() => onDelete(state));
            }}
          >
            Delete
          </button>
        )}
        <span className="spacer" />
        {spec.key === "saved" && state.rowNumber !== undefined && (
          <button type="button" className="button" disabled={busy} onClick={() => onMarkApplied(state)}>
            Mark as applied
          </button>
        )}
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "Saving…" : state.saveLabel}
        </button>
      </footer>
    </form>
  );
}
