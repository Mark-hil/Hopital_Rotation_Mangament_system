// Date manipulation and formatting utilities

export function fmtDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateShort(str) {
  if (!str) return "";
  return new Date(str).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

export function daysLeft(endDate) {
  return Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
}

export function daysSince(startDate) {
  return Math.ceil((new Date(startDate) - new Date()) / (1000 * 60 * 60 * 24));
}
