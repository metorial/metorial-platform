import mongoose from 'mongoose';

let scaleDigits = 18;
let scale = 10n ** BigInt(scaleDigits);
let decimalPattern = /^(-)?(\d+)(?:\.(\d+))?$/;
let maxSignificantDigits = 34;
let floatDigits = 12;

export type Decimal = mongoose.Types.Decimal128;

export type Amount = bigint;

export let parseAmount = (value: unknown): Amount | undefined => {
  let text =
    typeof value == 'string'
      ? value
      : value instanceof mongoose.Types.Decimal128
        ? value.toString()
        : typeof value == 'number' && Number.isFinite(value)
          ? value.toFixed(floatDigits)
          : undefined;

  let match = text ? decimalPattern.exec(text) : null;
  if (!match) return undefined;

  let fraction = (match[3] ?? '').slice(0, scaleDigits).padEnd(scaleDigits, '0');
  let amount = BigInt(match[2]!) * scale + BigInt(fraction);

  return match[1] ? -amount : amount;
};

export let formatAmount = (amount: Amount) => {
  let negative = amount < 0n;
  let absolute = negative ? -amount : amount;

  let integer = absolute / scale;
  let fraction = (absolute % scale).toString().padStart(scaleDigits, '0').replace(/0+$/, '');

  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
};

// Decimal128 holds 34 significant digits, so very large sums give up fraction digits.
export let toDecimal = (amount: Amount): Decimal => {
  let [integer, fraction] = formatAmount(amount).split('.');
  let room = Math.max(0, maxSignificantDigits - integer!.replace('-', '').length);
  let kept = fraction?.slice(0, room);

  return mongoose.Types.Decimal128.fromString(kept ? `${integer}.${kept}` : integer!);
};

export let decimalString = (value: Decimal | undefined) => value?.toString();
