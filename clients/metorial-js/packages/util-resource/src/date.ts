export let metorialDate = <D extends string | number | null | undefined>(value: D) =>
  new Date(value ?? 0);

export let metorialDateOptional = <D extends string | number | null | undefined>(value: D) =>
  value ? new Date(value) : null;
