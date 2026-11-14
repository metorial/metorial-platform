export let editions = ['cloud', 'on-prem'] as const;

export type Edition = (typeof editions)[number];

export let defaultEdition: Edition = 'cloud';

declare let __METORIAL_EDITION__: string | undefined;
declare let __METORIAL_BUILT__: boolean | undefined;

export let isEdition = (value: unknown): value is Edition =>
  editions.includes(value as Edition);

export let getEdition = (): Edition => {
  let raw =
    typeof __METORIAL_EDITION__ != 'undefined'
      ? __METORIAL_EDITION__
      : typeof process != 'undefined'
        ? process.env?.METORIAL_EDITION
        : undefined;

  if (!raw) return defaultEdition;

  if (!isEdition(raw)) {
    throw new Error(
      `Unknown METORIAL_EDITION "${raw}", expected one of: ${editions.join(', ')}`
    );
  }

  return raw;
};

export let checkEdition = (...allowed: [Edition, ...Edition[]]): boolean =>
  allowed.includes(getEdition());

export let assertEdition = (...allowed: [Edition, ...Edition[]]): void => {
  if (checkEdition(...allowed)) return;

  throw new Error(
    `This code is only available in the ${allowed.join(' / ')} edition, current edition is ${getEdition()}`
  );
};

export let perEdition = <T>(values: Record<Edition, T>): T => values[getEdition()];

// Bundles are built with __METORIAL_BUILT__ defined and the call itself is folded to `true`, so
// code guarded by !isBuilt() is removed from them. Nothing at runtime can switch it back.
export let isBuilt = (): boolean =>
  typeof __METORIAL_BUILT__ != 'undefined' && __METORIAL_BUILT__ === true;
