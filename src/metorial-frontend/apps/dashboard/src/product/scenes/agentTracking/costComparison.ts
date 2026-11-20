import { formatNumber } from '@metorial/chart';
import { formatRequests } from './sessionParts';

let listPriceSentence = (d: {
  listPrice: string | null;
  requests: number;
  requestsWithoutListPrice: number;
  format: (amount: string) => string;
}) => {
  let priced = d.requests - d.requestsWithoutListPrice;

  if (d.listPrice === null || priced <= 0) {
    return d.requests == 1
      ? 'The request has no list price.'
      : `None of the ${formatRequests(d.requests)} has a list price.`;
  }

  if (d.requestsWithoutListPrice <= 0) {
    return `Metorial at list prices: ${d.format(d.listPrice)}, for ${d.requests == 1 ? 'the one request' : `all ${formatRequests(d.requests)}`}.`;
  }

  return `Metorial at list prices: ${d.format(d.listPrice)}, for ${formatNumber(priced)} of ${formatRequests(d.requests)}; the other ${formatNumber(d.requestsWithoutListPrice)} ${d.requestsWithoutListPrice == 1 ? 'has' : 'have'} no list price.`;
};

// Nothing tells how many requests Claude Code's own figure covers, so only the list-price figure
// states its coverage, and the two are never presented as covering the same usage.
export let describeCostComparison = (d: {
  reportedByClient: string | null;
  listPrice: string | null;
  requests: number;
  requestsWithoutListPrice: number;
  format: (amount: string) => string;
}) => {
  if (d.requests <= 0) return null;

  let sentences = [
    d.reportedByClient !== null
      ? `Claude Code reported ${d.format(d.reportedByClient)}.`
      : null,
    listPriceSentence(d)
  ].filter((sentence): sentence is string => !!sentence);

  return `For comparison: ${sentences.join(' ')} Comparison figures are never added to the total.`;
};
