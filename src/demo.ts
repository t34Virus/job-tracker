// Development only (npm run dev, then open /?demo): an in-memory tracker with made-up rows, for working on
// the layout without signing in. Production builds never load this file.

import type { DataSource } from "./sheets";
import { TABS, type TabKey, type TrackerData } from "./schema";
import { formatDate, parseSheetDate } from "./dates";

const sample: Record<TabKey, Record<string, string>[]> = {
  applications: [
    { "Date applied": "Nov 17, 2026", Company: "Example Aerospace", Role: "Senior Full Stack Engineer", "Applied on": "LinkedIn", Status: "Interviewing", "Next step": "Technical interview Tuesday at 10 AM.", "Job link": "https://example.com/jobs/1", "Posted pay": "$150,000 - $190,000" },
    { "Date applied": "Nov 18, 2026", Company: "Sample Health", Role: "Software Engineer III, Full Stack", "Applied on": "Company careers site", Status: "Applied", "Next step": "Message the recruiter after they accept.", "Job link": "https://example.com/jobs/2" },
    { "Date applied": "Nov 10, 2026", Company: "Demo Studios", Role: "Creative Technologist", "Applied on": "Referral", Status: "Rejected", "Next step": "", Notes: "Asked for feedback." },
  ],
  outreach: [
    { Date: "Nov 18, 2026", Person: "Alex Rivera", "Their role": "Recruiter", Company: "Sample Health", Platform: "LinkedIn", Status: "Request sent", "Next step": "Send the follow-up when connected.", "Profile link": "https://example.com/in/alex" },
  ],
  saved: [
    { Company: "Placeholder Labs", Role: "Staff Frontend Engineer", "Location and work style": "Los Angeles, CA; hybrid", "Posted pay": "$180,000 - $220,000", "Job link": "https://example.com/jobs/3", "Materials ready": "General resume", "Why not applied yet": "Waiting on a referral." },
  ],
};

export class DemoSource implements DataSource {
  private data: TrackerData;

  constructor() {
    this.data = {} as TrackerData;
    for (const t of TABS) {
      this.data[t.key] = { headers: t.headers, rows: sample[t.key].map((values, i) => ({ rowNumber: i + 2, values: { ...values } })) };
    }
  }

  private renumber(tab: TabKey) {
    this.data[tab].rows.forEach((r, i) => (r.rowNumber = i + 2));
  }

  private display(values: Record<string, string>) {
    const out = { ...values };
    for (const [k, v] of Object.entries(out)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = formatDate(parseSheetDate(v)!);
    }
    return out;
  }

  async load() {
    return structuredClone(this.data);
  }
  async append(tab: TabKey, values: Record<string, string>) {
    this.data[tab].rows.push({ rowNumber: 0, values: this.display(values) });
    this.renumber(tab);
  }
  async update(tab: TabKey, rowNumber: number, values: Record<string, string>) {
    const row = this.data[tab].rows.find((r) => r.rowNumber === rowNumber);
    if (row) row.values = this.display(values);
  }
  async remove(tab: TabKey, rowNumber: number) {
    this.data[tab].rows = this.data[tab].rows.filter((r) => r.rowNumber !== rowNumber);
    this.renumber(tab);
  }
}
