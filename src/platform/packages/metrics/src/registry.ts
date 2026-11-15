export type Labels = Record<string, string>;

let maxSeriesPerMetric = 500;
let overflowValue = 'other';

let escapeLabelValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');

let escapeHelp = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');

let formatNumber = (value: number) => {
  if (value === Infinity) return '+Inf';
  if (value === -Infinity) return '-Inf';
  if (Number.isNaN(value)) return 'NaN';
  return String(value);
};

let formatLabels = (names: string[], values: string[], extra?: [string, string]) => {
  let parts = names.map((name, i) => `${name}="${escapeLabelValue(values[i] ?? '')}"`);
  if (extra) parts.push(`${extra[0]}="${escapeLabelValue(extra[1])}"`);
  return parts.length ? `{${parts.join(',')}}` : '';
};

abstract class Metric {
  protected series = new Map<string, { values: string[] }>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly labelNames: string[],
    readonly type: 'counter' | 'gauge' | 'histogram'
  ) {
    if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name))
      throw new Error(`Invalid metric name ${name}`);
  }

  // Bounds cardinality: once a metric has maxSeriesPerMetric label combinations, new ones are
  // folded into a single `other` series instead of growing without limit.
  protected key(labels: Labels = {}) {
    let values = this.labelNames.map(name => String(labels[name] ?? ''));
    let key = values.join('\u0000');

    if (!this.series.has(key)) {
      if (this.series.size >= maxSeriesPerMetric) {
        values = this.labelNames.map(() => overflowValue);
        key = values.join('\u0000');
      }
      this.series.set(key, { values });
      this.init(key);
    }

    return key;
  }

  protected abstract init(key: string): void;
  abstract render(): string[];

  protected header() {
    return [
      `# HELP ${this.name} ${escapeHelp(this.help)}`,
      `# TYPE ${this.name} ${this.type}`
    ];
  }

  get seriesCount() {
    return this.series.size;
  }

  abstract reset(): void;
}

export class Counter extends Metric {
  private counts = new Map<string, number>();

  constructor(opts: { name: string; help: string; labelNames?: string[] }) {
    super(opts.name, opts.help, opts.labelNames ?? [], 'counter');
  }

  protected init(key: string) {
    this.counts.set(key, 0);
  }

  inc(labels?: Labels, value = 1) {
    if (value < 0) return;
    let key = this.key(labels);
    this.counts.set(key, (this.counts.get(key) ?? 0) + value);
  }

  // For collectors that mirror a total owned elsewhere (process CPU time, for example).
  setTotal(labels: Labels | undefined, value: number) {
    this.counts.set(this.key(labels), value);
  }

  render() {
    let lines = this.header();
    for (let [key, { values }] of this.series) {
      lines.push(
        `${this.name}${formatLabels(this.labelNames, values)} ${formatNumber(this.counts.get(key) ?? 0)}`
      );
    }
    return lines;
  }

  reset() {
    this.series.clear();
    this.counts.clear();
  }
}

export class Gauge extends Metric {
  private current = new Map<string, number>();
  private collectors: Array<() => void | Promise<void>> = [];

  constructor(opts: {
    name: string;
    help: string;
    labelNames?: string[];
    collect?: (gauge: Gauge) => void | Promise<void>;
  }) {
    super(opts.name, opts.help, opts.labelNames ?? [], 'gauge');
    if (opts.collect) this.collectors.push(() => opts.collect!(this));
  }

  protected init(key: string) {
    this.current.set(key, 0);
  }

  set(labels: Labels | undefined, value: number) {
    this.current.set(this.key(labels), value);
  }

  inc(labels?: Labels, value = 1) {
    let key = this.key(labels);
    this.current.set(key, (this.current.get(key) ?? 0) + value);
  }

  dec(labels?: Labels, value = 1) {
    this.inc(labels, -value);
  }

  clear() {
    this.series.clear();
    this.current.clear();
  }

  async collect() {
    for (let collector of this.collectors) await collector();
  }

  render() {
    let lines = this.header();
    for (let [key, { values }] of this.series) {
      lines.push(
        `${this.name}${formatLabels(this.labelNames, values)} ${formatNumber(this.current.get(key) ?? 0)}`
      );
    }
    return lines;
  }

  reset() {
    this.clear();
  }
}

export let defaultBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

export class Histogram extends Metric {
  private data = new Map<string, { buckets: number[]; sum: number; count: number }>();
  readonly buckets: number[];

  constructor(opts: {
    name: string;
    help: string;
    labelNames?: string[];
    buckets?: number[];
  }) {
    super(opts.name, opts.help, opts.labelNames ?? [], 'histogram');
    this.buckets = [...(opts.buckets ?? defaultBuckets)].sort((a, b) => a - b);
  }

  protected init(key: string) {
    this.data.set(key, { buckets: this.buckets.map(() => 0), sum: 0, count: 0 });
  }

  observe(labels: Labels | undefined, value: number) {
    let entry = this.data.get(this.key(labels))!;
    entry.sum += value;
    entry.count += 1;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]!) entry.buckets[i]!++;
    }
  }

  startTimer(labels?: Labels) {
    let start = performance.now();
    return (extra?: Labels) =>
      this.observe({ ...labels, ...extra }, (performance.now() - start) / 1000);
  }

  render() {
    let lines = this.header();
    for (let [key, { values }] of this.series) {
      let entry = this.data.get(key)!;
      this.buckets.forEach((bound, i) => {
        lines.push(
          `${this.name}_bucket${formatLabels(this.labelNames, values, ['le', formatNumber(bound)])} ${entry.buckets[i]}`
        );
      });
      lines.push(
        `${this.name}_bucket${formatLabels(this.labelNames, values, ['le', '+Inf'])} ${entry.count}`
      );
      lines.push(
        `${this.name}_sum${formatLabels(this.labelNames, values)} ${formatNumber(entry.sum)}`
      );
      lines.push(`${this.name}_count${formatLabels(this.labelNames, values)} ${entry.count}`);
    }
    return lines;
  }

  reset() {
    this.series.clear();
    this.data.clear();
  }
}

export class Registry {
  private metrics = new Map<string, Counter | Gauge | Histogram>();
  private hooks: Array<() => void | Promise<void>> = [];

  private add<T extends Counter | Gauge | Histogram>(metric: T): T {
    let existing = this.metrics.get(metric.name);
    if (existing) {
      if (existing.type !== metric.type) {
        throw new Error(`Metric ${metric.name} is already registered as a ${existing.type}`);
      }
      return existing as T;
    }
    this.metrics.set(metric.name, metric);
    return metric;
  }

  counter(opts: ConstructorParameters<typeof Counter>[0]) {
    return this.add(new Counter(opts));
  }

  gauge(opts: ConstructorParameters<typeof Gauge>[0]) {
    return this.add(new Gauge(opts));
  }

  histogram(opts: ConstructorParameters<typeof Histogram>[0]) {
    return this.add(new Histogram(opts));
  }

  onCollect(hook: () => void | Promise<void>) {
    this.hooks.push(hook);
  }

  get(name: string) {
    return this.metrics.get(name);
  }

  names() {
    return [...this.metrics.keys()];
  }

  async render() {
    for (let hook of this.hooks) {
      try {
        await hook();
      } catch (error) {
        console.error('[metrics] collect hook failed', error);
      }
    }

    for (let metric of this.metrics.values()) {
      if (metric instanceof Gauge) {
        try {
          await metric.collect();
        } catch (error) {
          console.error(`[metrics] collecting ${metric.name} failed`, error);
        }
      }
    }

    let lines: string[] = [];
    for (let metric of this.metrics.values()) lines.push(...metric.render());
    return lines.join('\n') + '\n';
  }

  reset() {
    for (let metric of this.metrics.values()) metric.reset();
  }
}

export let registry = new Registry();
