// Reads and writes the tracker's Google Sheet through the Sheets API, using the signed-in account's token.

import { config } from "./config";
import { TABS, tabSpec, type TabKey, type TrackerData, type TabData, type Row } from "./schema";

export interface DataSource {
  load(): Promise<TrackerData>;
  append(tab: TabKey, values: Record<string, string>): Promise<void>;
  update(tab: TabKey, rowNumber: number, values: Record<string, string>): Promise<void>;
  remove(tab: TabKey, rowNumber: number): Promise<void>;
}

export class AuthExpiredError extends Error {}

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const quote = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

function column(n: number) {
  let s = "";
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

/** Turns grid values into rows keyed by header, skipping blank rows. */
export function toTabData(grid: string[][], fallbackHeaders: string[]): TabData {
  const headers = grid[0]?.length ? grid[0].map((h) => h.trim()) : fallbackHeaders;
  const rows: Row[] = [];
  grid.slice(1).forEach((cells, i) => {
    if (!cells.some((c) => c?.trim())) return;
    const values: Record<string, string> = {};
    headers.forEach((h, c) => (values[h] = cells[c] ?? ""));
    rows.push({ rowNumber: i + 2, values });
  });
  return { headers, rows };
}

/** Keeps text text: a leading = + - or @ would otherwise be read as a formula. Dates stay ISO so Sheets stores real dates. */
function cellValue(value: string) {
  const v = value ?? "";
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

export class SheetsSource implements DataSource {
  private headers: Partial<Record<TabKey, string[]>> = {};
  private sheetIds: Partial<Record<TabKey, number>> = {};
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async call<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...init.headers },
    });
    if (res.status === 401) throw new AuthExpiredError("Your sign-in expired. Sign in again to keep going.");
    if (res.status === 403) throw new Error("This Google account can't open the tracker sheet. Share the sheet with it as an editor, then refresh.");
    if (res.status === 404) throw new Error("The tracker sheet wasn't found. Check the sheet ID in the site's settings.");
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message || `Google Sheets returned an error (${res.status}).`);
    }
    return (await res.json()) as T;
  }

  async load(): Promise<TrackerData> {
    const params = new URLSearchParams({ valueRenderOption: "FORMATTED_VALUE", majorDimension: "ROWS" });
    TABS.forEach((t) => params.append("ranges", `${quote(t.sheet)}!A1:Z`));
    const [values, meta] = await Promise.all([
      this.call<{ valueRanges: { values?: string[][] }[] }>(`${API}/${config.sheetId}/values:batchGet?${params}`),
      this.call<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
        `${API}/${config.sheetId}?fields=sheets.properties.sheetId,sheets.properties.title`,
      ),
    ]);
    const data = {} as TrackerData;
    TABS.forEach((t, i) => {
      data[t.key] = toTabData(values.valueRanges[i]?.values ?? [], t.headers);
      this.headers[t.key] = data[t.key].headers;
      const sheet = meta.sheets.find((s) => s.properties.title === t.sheet);
      if (sheet) this.sheetIds[t.key] = sheet.properties.sheetId;
    });
    return data;
  }

  private row(tab: TabKey, values: Record<string, string>) {
    const headers = this.headers[tab] ?? tabSpec(tab).headers;
    return { headers, cells: headers.map((h) => cellValue(values[h] ?? "")) };
  }

  async append(tab: TabKey, values: Record<string, string>) {
    const { cells } = this.row(tab, values);
    const range = encodeURIComponent(`${quote(tabSpec(tab).sheet)}!A1`);
    await this.call(`${API}/${config.sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: [cells] }),
    });
  }

  async update(tab: TabKey, rowNumber: number, values: Record<string, string>) {
    const { headers, cells } = this.row(tab, values);
    const range = encodeURIComponent(`${quote(tabSpec(tab).sheet)}!A${rowNumber}:${column(headers.length)}${rowNumber}`);
    await this.call(`${API}/${config.sheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ values: [cells] }),
    });
  }

  async remove(tab: TabKey, rowNumber: number) {
    const sheetId = this.sheetIds[tab];
    if (sheetId === undefined) throw new Error(`Couldn't find the "${tabSpec(tab).sheet}" tab in the sheet.`);
    await this.call(`${API}/${config.sheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber } } }],
      }),
    });
  }
}
