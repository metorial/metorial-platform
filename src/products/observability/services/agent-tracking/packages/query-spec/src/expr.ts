import type { Expr } from './types';

export type WindowExpr =
  | { shareOfTotal: string }
  | { shareWithin: [string, string] }
  | { cumulative: string }
  | { movingAvg: [string, number] }
  | { rank: string };

export let isWindowExpr = (expr: Expr): expr is WindowExpr =>
  typeof expr == 'object' &&
  ('shareOfTotal' in expr ||
    'shareWithin' in expr ||
    'cumulative' in expr ||
    'movingAvg' in expr ||
    'rank' in expr);

export let needsTimeDimension = (expr: Expr): boolean => {
  if (typeof expr != 'object') return false;
  if ('cumulative' in expr || 'movingAvg' in expr) return true;

  return childrenOf(expr).some(needsTimeDimension);
};

let childrenOf = (expr: Exclude<Expr, number | string>): Expr[] => {
  if ('add' in expr) return expr.add;
  if ('sub' in expr) return expr.sub;
  if ('mul' in expr) return expr.mul;
  if ('div' in expr) return expr.div;
  if ('min' in expr) return expr.min;
  if ('max' in expr) return expr.max;
  if ('coalesce' in expr) return expr.coalesce;
  if ('abs' in expr) return [expr.abs];
  if ('round' in expr) return [expr.round[0]];

  return [];
};

export let exprReferences = (expr: Expr): { measures: string[]; dimensions: string[] } => {
  let measures = new Set<string>();
  let dimensions = new Set<string>();

  let walk = (node: Expr) => {
    if (typeof node == 'number') return;
    if (typeof node == 'string') {
      measures.add(node);
      return;
    }
    if ('shareOfTotal' in node) measures.add(node.shareOfTotal);
    else if ('cumulative' in node) measures.add(node.cumulative);
    else if ('rank' in node) measures.add(node.rank);
    else if ('movingAvg' in node) measures.add(node.movingAvg[0]);
    else if ('shareWithin' in node) {
      measures.add(node.shareWithin[0]);
      dimensions.add(node.shareWithin[1]);
    } else childrenOf(node).forEach(walk);
  };

  walk(expr);

  return { measures: [...measures], dimensions: [...dimensions] };
};

let isNumber = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

// `window` answers the window sub-expressions (shareOfTotal, cumulative, …), which need every row
// of the result; the caller computes them before evaluating the row.
export let evaluateExpr = (
  expr: Expr,
  d: {
    value: (name: string) => number | null;
    window?: (expr: WindowExpr) => number | null;
  }
): number | null => {
  let evaluate = (node: Expr): number | null => {
    if (typeof node == 'number') return node;
    if (typeof node == 'string') return d.value(node);
    if (isWindowExpr(node)) return d.window ? d.window(node) : null;

    if ('add' in node || 'mul' in node) {
      let items = ('add' in node ? node.add : node.mul).map(evaluate);
      if (!items.every(isNumber)) return null;

      return 'add' in node
        ? items.reduce((total, item) => total + item, 0)
        : items.reduce((total, item) => total * item, 1);
    }
    if ('sub' in node) {
      let [a, b] = node.sub.map(evaluate);
      return isNumber(a!) && isNumber(b!) ? a - b : null;
    }
    if ('div' in node) {
      let [a, b] = node.div.map(evaluate);
      return isNumber(a!) && isNumber(b!) && b != 0 ? a / b : null;
    }
    if ('min' in node || 'max' in node) {
      let items = ('min' in node ? node.min : node.max).map(evaluate).filter(isNumber);
      if (!items.length) return null;

      return 'min' in node ? Math.min(...items) : Math.max(...items);
    }
    if ('abs' in node) {
      let value = evaluate(node.abs);
      return isNumber(value) ? Math.abs(value) : null;
    }
    if ('round' in node) {
      let value = evaluate(node.round[0]);
      let factor = 10 ** node.round[1];
      return isNumber(value) ? Math.round(value * factor) / factor : null;
    }
    if ('coalesce' in node) {
      for (let item of node.coalesce) {
        let value = evaluate(item);
        if (isNumber(value)) return value;
      }
      return null;
    }

    return null;
  };

  return evaluate(expr);
};
