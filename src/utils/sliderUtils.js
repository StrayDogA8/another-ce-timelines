export const DETAIL_MIN = 0.2;
export const DETAIL_MID = 1;
export const DETAIL_MAX = 5;

export const TICK_DENSITY_MIN = 0.1;
export const TICK_DENSITY_MID = 1;
export const TICK_DENSITY_MAX = 2;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const detailToSlider = (value) => {
  const clamped = clamp(value, DETAIL_MIN, DETAIL_MAX);
  if (clamped <= DETAIL_MID) {
    const ratio = (clamped - DETAIL_MIN) / (DETAIL_MID - DETAIL_MIN);
    return ratio * 50;
  }
  const ratio = (clamped - DETAIL_MID) / (DETAIL_MAX - DETAIL_MID);
  return 50 + ratio * 50;
};

export const sliderToDetail = (position) => {
  const pos = clamp(position, 0, 100);
  if (pos <= 50) {
    const ratio = pos / 50;
    return DETAIL_MIN + ratio * (DETAIL_MID - DETAIL_MIN);
  }
  const ratio = (pos - 50) / 50;
  return DETAIL_MID + ratio * (DETAIL_MAX - DETAIL_MID);
};

export const tickDensityToSlider = (value) => {
  const clamped = clamp(value, TICK_DENSITY_MIN, TICK_DENSITY_MAX);
  if (clamped <= TICK_DENSITY_MID) {
    const ratio = (clamped - TICK_DENSITY_MIN) / (TICK_DENSITY_MID - TICK_DENSITY_MIN);
    return ratio * 50;
  }
  const ratio = (clamped - TICK_DENSITY_MID) / (TICK_DENSITY_MAX - TICK_DENSITY_MID);
  return 50 + ratio * 50;
};

export const sliderToTickDensity = (position) => {
  const pos = clamp(position, 0, 100);
  if (pos <= 50) {
    const ratio = pos / 50;
    return TICK_DENSITY_MIN + ratio * (TICK_DENSITY_MID - TICK_DENSITY_MIN);
  }
  const ratio = (pos - 50) / 50;
  return TICK_DENSITY_MID + ratio * (TICK_DENSITY_MAX - TICK_DENSITY_MID);
};
