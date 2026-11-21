import { formatNumber } from '@metorial/chart';
import { formatRequests } from './sessionParts';

let listPriceSentence = (d: {
  listPriceMicros: number | null;
  requests: number;
  requestsWithoutListPrice: number;
  format: (micros: number) => string;
}) => {
  let priced = d.requests - d.requestsWithoutListPrice;

  if (d.listPriceMicros === null || priced <= 0) {
    return d.requests == 1
      ? 'The request has no list price.'
      : `None of the ${formatRequests(d.requests)} has a list price.`;
  }

  if (d.requestsWithoutListPrice <= 0) {
    return `Metorial at list prices: ${d.format(d.listPriceMicros)}, for ${d.requests == 1 ? 'the one request' : `all ${formatRequests(d.requests)}`}.`;
  }

  return `Metorial at list prices: ${d.format(d.listPriceMicros)}, for ${formatNumber(priced)} of ${formatRequests(d.requests)}; the other ${formatNumber(d.requestsWithoutListPrice)} ${d.requestsWithoutListPrice == 1 ? 'has' : 'have'} no list price.`;
};

export let describeCostComparison = (d: {
  reportedByClientMicros: number | null;
  listPriceMicros: number | null;
  requests: number;
  requestsWithoutListPrice: number;
  format: (micros: number) => string;
}) => {
  if (d.requests <= 0) return null;

  let sentences = [
    d.reportedByClientMicros !== null
      ? `Claude Code reported ${d.format(d.reportedByClientMicros)}.`
      : null,
    listPriceSentence(d)
  ].filter((sentence): sentence is string => !!sentence);

  return `For comparison: ${sentences.join(' ')} Comparison figures are never added to the total.`;
};
