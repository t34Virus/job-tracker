// The three tabs of the Google Sheet. Rows are read by header name, so the sheet's column order can change;
// these specs only decide how each known column is edited and shown.

export type TabKey = "applications" | "outreach" | "saved";
export type FieldKind = "text" | "long" | "date" | "url" | "status";

export interface TabSpec {
  key: TabKey;
  sheet: string; // tab name in the spreadsheet
  title: string;
  singular: string;
  /** Default headers, used when the tab is empty. */
  headers: string[];
  kinds: Record<string, FieldKind>;
  statuses?: string[];
  dateField?: string;
  statusField?: string;
  linkField?: string;
  /** Columns shown in the table on wide screens. */
  columns: string[];
  /** Card title and subtitle on phones. */
  primary: string;
  secondary: string;
}

export const APPLICATION_STATUSES = ["Applied", "Recruiter screen", "Interviewing", "Offer", "Rejected", "Withdrawn", "No response"];
export const OUTREACH_STATUSES = ["Request sent", "Connected", "Replied", "Call scheduled", "Referred me", "No reply"];

export const TABS: TabSpec[] = [
  {
    key: "applications",
    sheet: "Applications",
    title: "Applications",
    singular: "application",
    headers: ["Date applied", "Company", "Role", "Job ID", "Location and work style", "Posted pay", "Applied on", "Job link", "Resume sent", "Also sent", "Status", "Next step", "Notes"],
    kinds: { "Date applied": "date", "Job link": "url", Status: "status", "Also sent": "long", "Next step": "long", Notes: "long" },
    statuses: APPLICATION_STATUSES,
    dateField: "Date applied",
    statusField: "Status",
    linkField: "Job link",
    columns: ["Date applied", "Company", "Role", "Applied on", "Status", "Next step"],
    primary: "Company",
    secondary: "Role",
  },
  {
    key: "outreach",
    sheet: "Outreach",
    title: "Outreach",
    singular: "outreach",
    headers: ["Date", "Person", "Their role", "Company", "Platform", "Profile link", "Related job", "What I sent", "Status", "Next step"],
    kinds: { Date: "date", "Profile link": "url", Status: "status", "What I sent": "long", "Next step": "long" },
    statuses: OUTREACH_STATUSES,
    dateField: "Date",
    statusField: "Status",
    linkField: "Profile link",
    columns: ["Date", "Person", "Company", "Platform", "Status", "Next step"],
    primary: "Person",
    secondary: "Company",
  },
  {
    key: "saved",
    sheet: "Saved, not applied",
    title: "Saved",
    singular: "saved job",
    headers: ["Company", "Role", "Job ID", "Location and work style", "Posted pay", "Job link", "Materials ready", "Why not applied yet"],
    kinds: { "Job link": "url", "Materials ready": "long", "Why not applied yet": "long" },
    linkField: "Job link",
    columns: ["Company", "Role", "Location and work style", "Posted pay", "Why not applied yet"],
    primary: "Company",
    secondary: "Role",
  },
];

export const tabSpec = (key: TabKey) => TABS.find((t) => t.key === key)!;

/** Statuses that mean a job is still moving. */
export const ACTIVE_STATUSES = new Set(["Applied", "Recruiter screen", "Interviewing", "Offer"]);
export const INTERVIEW_STATUSES = new Set(["Recruiter screen", "Interviewing", "Offer"]);

export interface Row {
  rowNumber: number; // 1-based row in the sheet
  values: Record<string, string>;
}

export interface TabData {
  headers: string[];
  rows: Row[];
}

export type TrackerData = Record<TabKey, TabData>;
