import { formatCurrency } from '@metorial/chart';

// An amount below a cent already reads as a bound ("<$0.01"), so it gets no tilde.
export let formatAmount = (amount: string, opts: { estimate: boolean }) => {
  let formatted = formatCurrency(amount);
  let isBound = formatted.startsWith('<') || formatted.startsWith('>');

  return `${opts.estimate && !isBound ? '~' : ''}${formatted}`;
};

export let formatCost = (amount: string | null, opts: { estimate: boolean }) =>
  amount === null ? null : formatAmount(amount, opts);
