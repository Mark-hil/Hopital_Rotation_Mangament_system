import { WARD_LOOKUP } from "../constants/wardGroups";
import { daysLeft } from "./dates";

export const TOTAL_WEEKS = { nursing: 52, midwifery: 52 };

export const ACTIVE_STATUSES = ["active", "ending_soon", "completing_today"];

export function weeksFor(group, wardName) {
  return WARD_LOOKUP[wardName]?.[group] ?? 0;
}

export function assignmentStatus(a) {
  if (!a || !a.endDate || !a.startDate) return "unassigned";
  const dl = daysLeft(a.endDate);
  const ds = Math.ceil((new Date(a.startDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (ds > 0) return "upcoming";
  if (dl < 0) return "completed";
  if (dl === 0) return "completing_today";
  if (dl <= 7) return "ending_soon";
  return "active";
}

export function getLatestPlacement(memberId, assignments = []) {
  const ma = assignments
    .filter((a) => a.memberId === memberId)
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  if (!ma.length) return null;
  const latest = ma[0];
  const dl = daysLeft(latest.endDate);
  const now = new Date();
  const ds = Math.ceil((new Date(latest.startDate) - now) / (1000 * 60 * 60 * 24));
  let status;
  if (ds > 0) status = "upcoming";
  else if (dl < 0) status = "completed";
  else if (dl === 0) status = "completing_today";
  else if (dl <= 7) status = "ending_soon";
  else status = "active";
  return { ...latest, daysLeft: dl, status };
}

export const STATUS_CFG = {
  active:           { bg: "#ECFDF5", color: "#065F46", dot: "#22C55E", label: "Active" },
  ending_soon:      { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Ending soon" },
  completing_today: { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Ends today" },
  completed:        { bg: "#FFF1F2", color: "#BE123C", dot: "#F43F5E", label: "Completed — Ready" },
  upcoming:         { bg: "#F8FAFC", color: "#475569", dot: "#94A3B8", label: "Upcoming" },
  unassigned:       { bg: "#F8FAFC", color: "#64748B", dot: "#CBD5E1", label: "Unassigned" },
};
