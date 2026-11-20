import { formatCurrency } from '@metorial/chart';

export let dollarsOf = (micros: number) => {
  let digits = String(Math.abs(micros)).padStart(7, '0');

  return `${micros < 0 ? '-' : ''}${digits.slice(0, -6)}.${digits.slice(-6)}`;
};

export let formatAmount = (micros: number, opts: { estimate: boolean }) => {
  let formatted = formatCurrency(dollarsOf(micros));
  let isBound = formatted.startsWith('<') || formatted.startsWith('>');

  return `${opts.estimate && !isBound ? '~' : ''}${formatted}`;
};

export let formatCost = (micros: number | null, opts: { estimate: boolean }) =>
  micros === null ? null : formatAmount(micros, opts);
