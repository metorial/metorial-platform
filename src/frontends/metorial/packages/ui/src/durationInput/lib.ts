export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export let durationUnitSeconds: Record<DurationUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60
};

export let defaultDurationUnits: DurationUnit[] = ['seconds', 'minutes', 'hours', 'days'];

let sortUnitsAscending = (units: readonly DurationUnit[]) =>
  [...units].sort((a, b) => durationUnitSeconds[a] - durationUnitSeconds[b]);

export let pickDurationUnit = (
  seconds: number | null | undefined,
  units: readonly DurationUnit[] = defaultDurationUnits
): DurationUnit => {
  let ascending = sortUnitsAscending(units.length ? units : defaultDurationUnits);

  if (!seconds) return ascending.includes('minutes') ? 'minutes' : ascending[0]!;

  let evenUnit = [...ascending]
    .reverse()
    .find(unit => seconds % durationUnitSeconds[unit] == 0);

  return evenUnit ?? ascending[0]!;
};

export let getDurationParts = (
  seconds: number,
  units: readonly DurationUnit[] = defaultDurationUnits
) => {
  let unit = pickDurationUnit(seconds, units);

  return { amount: seconds / durationUnitSeconds[unit], unit };
};
