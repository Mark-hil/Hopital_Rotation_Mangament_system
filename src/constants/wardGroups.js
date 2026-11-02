// Ward Data, Department color palettes, and Lookup Maps

export const WARD_GROUPS = [
  {
    group: "Medical", color: "#EFF6FF", accent: "#3B82F6", textColor: "#1E40AF",
    wards: [
      { name: "Emergency",       nursing: 3, midwifery: 2 },
      { name: "Males' Ward",     nursing: 3, midwifery: 2 },
      { name: "Females' Ward",   nursing: 3, midwifery: 2 },
      { name: "Paediatric Ward", nursing: 3, midwifery: 2 },
      { name: "OPD",             nursing: 0, midwifery: 2 },
    ],
  },
  {
    group: "Surgical", color: "#F0FDF4", accent: "#22C55E", textColor: "#15803D",
    wards: [
      { name: "Surgical Ward",  nursing: 4, midwifery: 2 },
      { name: "Theatre",        nursing: 4, midwifery: 2 },
      { name: "Recovery Ward",  nursing: 4, midwifery: 2 },
    ],
  },
  {
    group: "Special Clinics", color: "#FFF7ED", accent: "#F97316", textColor: "#C2410C",
    wards: [
      { name: "Eye Clinic",                    nursing: 1, midwifery: 1 },
      { name: "ENT",                           nursing: 2, midwifery: 1 },
      { name: "Dental",                        nursing: 2, midwifery: 1 },
      { name: "Dialysis",                      nursing: 1, midwifery: 1 },
      { name: "Sickle Cell / HPT / DM Clinic", nursing: 1, midwifery: 0 },
      { name: "Isolation",                     nursing: 2, midwifery: 0 },
    ],
  },
  {
    group: "Obstetrics", color: "#FDF4FF", accent: "#A855F7", textColor: "#7E22CE",
    wards: [
      { name: "ANC/PNC Clinic", nursing: 2,  midwifery: 6  },
      { name: "ANC/PNC Ward",   nursing: 2,  midwifery: 4  },
      { name: "Labour Ward",    nursing: 3,  midwifery: 12 },
      { name: "NCU",            nursing: 3,  midwifery: 4  },
    ],
  },
  {
    group: "Public Health", color: "#ECFDF5", accent: "#10B981", textColor: "#065F46",
    wards: [
      { name: "Nutrition",                    nursing: 1, midwifery: 0 },
      { name: "RCH",                          nursing: 2, midwifery: 4 },
      { name: "HIV / ART Clinic",             nursing: 1, midwifery: 0 },
      { name: "HIV / ART",                    nursing: 0, midwifery: 2 },
      { name: "Nutrition & Health Promotion", nursing: 0, midwifery: 2 },
    ],
  },
  {
    group: "Psychiatry", color: "#FFF1F2", accent: "#F43F5E", textColor: "#BE123C",
    wards: [{ name: "Psychiatry", nursing: 8, midwifery: 4 }],
  },
];

export const WARD_LOOKUP = {};
export const ALL_WARD_NAMES = [];

export const DEPT_THEMES = Object.fromEntries(
  WARD_GROUPS.map(g => [g.group, { color: g.color, accent: g.accent, textColor: g.textColor }])
);

export const EXTRA_THEMES = [
  { color: "#F0F9FF", accent: "#0EA5E9", textColor: "#0369A1" },
  { color: "#FEFCE8", accent: "#EAB308", textColor: "#A16207" },
  { color: "#F5F3FF", accent: "#8B5CF6", textColor: "#6D28D9" },
  { color: "#FDF2F8", accent: "#EC4899", textColor: "#BE185D" },
  { color: "#F0FDFA", accent: "#14B8A6", textColor: "#0F766E" },
  { color: "#FEF2F2", accent: "#EF4444", textColor: "#B91C1C" },
];

export function themeForDept(dept) {
  if (DEPT_THEMES[dept]) return DEPT_THEMES[dept];
  let h = 0;
  for (const ch of dept || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA_THEMES[h % EXTRA_THEMES.length];
}

// Default rows (used when the `wards` table hasn't been created yet).
export const DEFAULT_WARD_ROWS = WARD_GROUPS.flatMap((g, gi) =>
  g.wards.map((w, wi) => ({
    id: null,
    name: w.name,
    department: g.group,
    nursing_weeks: w.nursing,
    midwifery_weeks: w.midwifery,
    capacity: null,
    sort_order: (gi * 10 + wi) * 10,
  }))
);

export function rebuildWardIndex() {
  Object.keys(WARD_LOOKUP).forEach(k => delete WARD_LOOKUP[k]);
  WARD_GROUPS.forEach((g) =>
    g.wards.forEach((w) => {
      WARD_LOOKUP[w.name] = { ...w, color: g.color, accent: g.accent, textColor: g.textColor, group: g.group };
    })
  );
  ALL_WARD_NAMES.splice(0, ALL_WARD_NAMES.length, ...WARD_GROUPS.flatMap(g => g.wards.map(w => w.name)));
}

rebuildWardIndex();

// Replace the in-memory ward list with rows from the `wards` table.
export function applyWardRows(rows) {
  if (!rows || !rows.length) return;
  const sorted = [...rows].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
  );
  const groups = [];
  const byDept = {};
  sorted.forEach(r => {
    if (!byDept[r.department]) {
      byDept[r.department] = { group: r.department, ...themeForDept(r.department), wards: [] };
      groups.push(byDept[r.department]);
    }
    byDept[r.department].wards.push({
      id: r.id,
      name: r.name,
      nursing: r.nursing_weeks ?? 0,
      midwifery: r.midwifery_weeks ?? 0,
      capacity: r.capacity ?? null,
    });
  });
  WARD_GROUPS.splice(0, WARD_GROUPS.length, ...groups);
  rebuildWardIndex();
}
