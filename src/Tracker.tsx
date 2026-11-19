import { useCallback, useEffect, useMemo, useState } from "react";
import { TABS, tabSpec, ACTIVE_STATUSES, INTERVIEW_STATUSES, type TabKey, type TrackerData, type Row, type TabSpec } from "./schema";
import { AuthExpiredError, type DataSource } from "./sheets";
import { parseSheetDate, startOfWeek, todayISO } from "./dates";
import { RecordDialog, type DialogState } from "./RecordDialog";
import { sheetUrl } from "./config";

interface Props {
  source: DataSource;
  email: string;
  onSignOut: () => void;
  onAuthExpired: () => void;
  demo?: boolean;
}

let dialogSeq = 0;
const nextDialogId = () => ++dialogSeq;

const statusClass = (s: string) => `pill pill-${s.toLowerCase().replace(/\W+/g, "-")}`;

function sortRows(spec: TabSpec, rows: Row[]) {
  if (!spec.dateField) return rows;
  const time = (r: Row) => parseSheetDate(r.values[spec.dateField!])?.getTime() ?? 0;
  return [...rows].sort((a, b) => time(b) - time(a) || b.rowNumber - a.rowNumber);
}

function Cell({ spec, header, value }: { spec: TabSpec; header: string; value: string }) {
  if (!value) return <span className="faint">-</span>;
  if (header === spec.statusField) return <span className={statusClass(value)}>{value}</span>;
  return <>{value}</>;
}

function OpenLink({ href, label }: { href: string; label: string }) {
  if (!/^https?:\/\//.test(href)) return null;
  return (
    <a className="open" href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label={label} title={label}>
      ↗
    </a>
  );
}

export function Tracker({ source, email, onSignOut, onAuthExpired, demo }: Props) {
  const [data, setData] = useState<TrackerData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>(() => (TABS.some((t) => `#${t.key}` === location.hash) ? (location.hash.slice(1) as TabKey) : "applications"));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const handle = useCallback(
    (e: unknown) => {
      if (e instanceof AuthExpiredError) onAuthExpired();
      else setError(e instanceof Error ? e.message : "Something went wrong.");
    },
    [onAuthExpired],
  );

  // First load. A response that arrives after sign-out (or a new session) is ignored.
  useEffect(() => {
    let current = true;
    source
      .load()
      .then(
        (next) => {
          if (current) {
            setData(next);
            setError("");
          }
        },
        (e: unknown) => current && handle(e),
      )
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [source, handle]);

  const refresh = async () => {
    setLoading(true);
    try {
      setData(await source.load());
      setError("");
    } catch (e) {
      handle(e);
    } finally {
      setLoading(false);
    }
  };

  // Keeps the open tab in the address bar, so a reload or bookmark returns to it.
  useEffect(() => {
    history.replaceState(null, "", `#${tab}`);
  }, [tab]);

  const selectTab = (key: TabKey) => {
    setTab(key);
    setStatus("");
  };

  const spec = tabSpec(tab);
  const tabData = data?.[tab];

  const rows = useMemo(() => {
    if (!tabData) return [];
    const q = query.trim().toLowerCase();
    const filtered = tabData.rows.filter(
      (r) => (!q || Object.values(r.values).some((v) => v.toLowerCase().includes(q))) && (!status || r.values[spec.statusField ?? ""] === status),
    );
    return sortRows(spec, filtered);
  }, [tabData, query, status, spec]);

  const stats = useMemo(() => {
    if (!data) return null;
    const apps = data.applications.rows;
    const weekStart = startOfWeek().getTime();
    return [
      { label: "Applications", value: apps.length },
      { label: "This week", value: apps.filter((r) => (parseSheetDate(r.values["Date applied"])?.getTime() ?? 0) >= weekStart).length },
      { label: "Still active", value: apps.filter((r) => ACTIVE_STATUSES.has(r.values.Status)).length },
      { label: "Interviews", value: apps.filter((r) => INTERVIEW_STATUSES.has(r.values.Status)).length },
      { label: "Outreach", value: data.outreach.rows.length },
    ];
  }, [data]);

  const headersFor = (key: TabKey) => data?.[key].headers ?? tabSpec(key).headers;

  const openNew = (key: TabKey = tab) => {
    const s = tabSpec(key);
    const values: Record<string, string> = {};
    if (s.dateField) values[s.dateField] = todayISO();
    if (s.statusField && s.statuses) values[s.statusField] = s.statuses[0];
    setDialog({ id: nextDialogId(), spec: s, headers: headersFor(key), values, title: `Add ${s.singular}`, saveLabel: "Add" });
  };

  const openRow = (row: Row) =>
    setDialog({ id: nextDialogId(), spec, headers: headersFor(tab), values: row.values, rowNumber: row.rowNumber, title: `Edit ${spec.singular}`, saveLabel: "Save" });

  /** Saved job -> a prefilled application; saving it adds the application and removes the saved row. */
  const markApplied = (from: DialogState) => {
    const v = from.values;
    const apps = tabSpec("applications");
    setDialog({
      id: nextDialogId(),
      spec: apps,
      headers: headersFor("applications"),
      values: {
        "Date applied": todayISO(),
        Company: v.Company ?? "",
        Role: v.Role ?? "",
        "Job ID": v["Job ID"] ?? "",
        "Location and work style": v["Location and work style"] ?? "",
        "Posted pay": v["Posted pay"] ?? "",
        "Job link": v["Job link"] ?? "",
        "Resume sent": v["Materials ready"] ?? "",
        Status: "Applied",
      },
      title: "Add application",
      saveLabel: "Add application",
      fromSavedRow: from.rowNumber,
    });
  };

  const save = async (d: DialogState, values: Record<string, string>) => {
    try {
      if (d.rowNumber !== undefined) await source.update(d.spec.key, d.rowNumber, values);
      else await source.append(d.spec.key, values);
      if (d.fromSavedRow !== undefined) await source.remove("saved", d.fromSavedRow);
    } catch (e) {
      if (e instanceof AuthExpiredError) onAuthExpired();
      throw e;
    }
    setDialog(null);
    if (d.fromSavedRow !== undefined) selectTab("applications");
    await refresh();
  };

  const remove = async (d: DialogState) => {
    try {
      await source.remove(d.spec.key, d.rowNumber!);
    } catch (e) {
      if (e instanceof AuthExpiredError) onAuthExpired();
      throw e;
    }
    setDialog(null);
    await refresh();
  };

  return (
    <div className="app">
      <header className="top">
        <div className="title">
          <span aria-hidden="true">🌺</span>
          <h1>Job Search</h1>
          {demo && <span className="pill pill-demo">Demo data</span>}
        </div>
        <div className="account">
          {!demo && (
            <a className="text-link" href={sheetUrl()} target="_blank" rel="noreferrer">
              Open sheet
            </a>
          )}
          <span className="email" title={email}>
            {email}
          </span>
          <button className="button ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {stats && (
        <section className="stats" aria-label="Summary">
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </section>
      )}

      <nav className="tabs" role="tablist" aria-label="Tracker tabs">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className="tab" onClick={() => selectTab(t.key)}>
            {t.title}
            <span className="count">{data?.[t.key].rows.length ?? "·"}</span>
          </button>
        ))}
      </nav>

      <div className="toolbar">
        <input className="search" type="search" placeholder={`Search ${spec.title.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
        {spec.statuses && (
          <select className="filter" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {spec.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        <span className="spacer" />
        <button className="button ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button className="button primary" onClick={() => openNew()}>
          Add {spec.singular}
        </button>
      </div>

      {error && (
        <p className="error banner" role="alert">
          {error}
        </p>
      )}

      {data && rows.length === 0 && !loading && (
        <p className="empty">{query || status ? "Nothing matches that search." : `No ${spec.title.toLowerCase()} yet.`}</p>
      )}

      {rows.length > 0 && (
        <>
          <table className="table">
            <thead>
              <tr>
                {spec.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
                <th aria-label="Link" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rowNumber} tabIndex={0} onClick={() => openRow(r)} onKeyDown={(e) => e.key === "Enter" && openRow(r)}>
                  {spec.columns.map((c) => (
                    <td key={c} className={c === spec.primary ? "strong" : undefined}>
                      <Cell spec={spec} header={c} value={r.values[c] ?? ""} />
                    </td>
                  ))}
                  <td className="link-cell">{spec.linkField && <OpenLink href={r.values[spec.linkField] ?? ""} label={`Open ${spec.linkField.toLowerCase()}`} />}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="cards">
            {rows.map((r) => {
              const v = r.values;
              const meta = [spec.dateField && v[spec.dateField], tab === "applications" && v["Applied on"], tab === "outreach" && v.Platform, tab === "saved" && v["Location and work style"]].filter(Boolean);
              const next = v["Next step"] || v["Why not applied yet"];
              return (
                <li key={r.rowNumber}>
                  <button className="card" onClick={() => openRow(r)}>
                    <span className="card-head">
                      <span className="card-title">{v[spec.primary] || "Untitled"}</span>
                      {spec.statusField && v[spec.statusField] && <span className={statusClass(v[spec.statusField])}>{v[spec.statusField]}</span>}
                    </span>
                    {v[spec.secondary] && <span className="card-sub">{v[spec.secondary]}</span>}
                    {meta.length > 0 && <span className="card-meta">{meta.join(" · ")}</span>}
                    {next && <span className="card-next">{next}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <RecordDialog state={dialog} onClose={() => setDialog(null)} onSave={save} onDelete={remove} onMarkApplied={markApplied} />
    </div>
  );
}
