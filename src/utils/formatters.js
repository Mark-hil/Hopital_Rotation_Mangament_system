// Text, initial, and name formatting utilities
export { fmtDate, fmtDateShort } from "./dates";

export function initials(name = "") {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function capitalize(str = "") {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str = "", maxLen = 30) {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}
