export const daysInMonth = (year, month) => {
  const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return monthDays[month - 1] || 0;
};

const precisionFromValue = (value) => {
  if (!Number.isFinite(value)) return null;
  if (Number.isInteger(value)) return "year";
  const scaled = value * 12;
  const isMonthGrid = Math.abs(scaled - Math.round(scaled)) < 1e-6;
  return isMonthGrid ? "month" : "day";
};

export const parseTimelineInput = (value) => {
  if (value === null || value === undefined) {
    return { value: null, label: null, precision: null };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { value, label: null, precision: precisionFromValue(value) };
  }

  const raw = String(value).trim();
  if (!raw) return { value: null, label: null, precision: null };

  if (raw.includes("/")) {
    const parts = raw.split("/");
    if (parts.length !== 2 && parts.length !== 3) return { value: null, label: null, precision: null };
    const [monthRaw, midRaw, yearRaw] = parts.map((part) => part.trim());
    const month = Number(monthRaw);
    const rawYear = Number(parts.length === 2 ? midRaw : yearRaw);
    const year = (Number.isFinite(rawYear) && rawYear >= 0 && rawYear <= 99) ? rawYear + 2000 : rawYear;
    const day = parts.length === 2 ? 1 : Number(midRaw);

    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
      return { value: null, label: null, precision: null };
    }
    if (month < 1 || month > 12) return { value: null, label: null, precision: null };
    const maxDay = daysInMonth(year, month);
    if (day < 1 || day > maxDay) return { value: null, label: null, precision: null };

    const monthBase = (month - 1) / 12;
    const monthDays = daysInMonth(year, month);
    const dayOffset = (day - 1) / (monthDays * 12);
    return {
      value: year + monthBase + dayOffset,
      label: raw,
      precision: parts.length === 2 ? "month" : "day",
    };
  }

  const num = Number(raw);
  return Number.isFinite(num)
    ? { value: num, label: null, precision: precisionFromValue(num) }
    : { value: null, label: null, precision: null };
};

export const snapToMonthGrid = (value) => {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 12) / 12;
};

export const fractionalYearToDate = (value) => {
  const yearInt = Math.floor(value);
  const fraction = Math.max(0, value - yearInt);
  const monthIndex = Math.min(11, Math.floor(fraction * 12 + 1e-9));
  const month = monthIndex + 1;
  const monthFraction = Math.max(0, fraction * 12 - monthIndex);
  const days = daysInMonth(yearInt, month);
  const day = Math.min(days, Math.max(1, Math.floor(monthFraction * days + 1e-9) + 1));
  return { year: yearInt, month, day };
};

export const snapToDayGrid = (value) => {
  if (!Number.isFinite(value)) return value;
  const yearInt = Math.floor(value);
  const fraction = Math.max(0, value - yearInt);
  const monthIndex = Math.min(11, Math.floor(fraction * 12 + 1e-9));
  const month = monthIndex + 1;
  const monthFraction = Math.max(0, fraction * 12 - monthIndex);
  const days = daysInMonth(yearInt, month);
  const day = Math.min(days, Math.max(1, Math.round(monthFraction * days + 0.5 - 1e-9) + 1));
  return yearInt + (month - 1) / 12 + (day - 1) / (days * 12);
};
