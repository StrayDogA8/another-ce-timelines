const daysInMonth = (year, month) => {
  const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return monthDays[month - 1] || 0;
};

const dayOfYear = (year, month, day) => {
  let total = 0;
  for (let m = 1; m < month; m += 1) {
    total += daysInMonth(year, m);
  }
  return total + day;
};

export const parseTimelineInput = (value) => {
  if (value === null || value === undefined) {
    return { value: null, label: null };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { value, label: null };
  }

  const raw = String(value).trim();
  if (!raw) return { value: null, label: null };

  if (raw.includes("/")) {
    const parts = raw.split("/");
    if (parts.length !== 2 && parts.length !== 3) return { value: null, label: null };
    const [monthRaw, midRaw, yearRaw] = parts.map((part) => part.trim());
    const month = Number(monthRaw);
    const year = Number(parts.length === 2 ? midRaw : yearRaw);
    const day = parts.length === 2 ? 1 : Number(midRaw);

    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
      return { value: null, label: null };
    }
    if (month < 1 || month > 12) return { value: null, label: null };
    const maxDay = daysInMonth(year, month);
    if (day < 1 || day > maxDay) return { value: null, label: null };

    const doy = dayOfYear(year, month, day);
    const yearDays = daysInMonth(year, 2) === 29 ? 366 : 365;
    return { value: year + (doy - 1) / yearDays, label: raw };
  }

  const num = Number(raw);
  return Number.isFinite(num) ? { value: num, label: null } : { value: null, label: null };
};
