import { v, type ValidationTypeValue } from '@lowerdeck/validation';
import { parseWith } from '../lib/schema';

// Assumed list prices: AWS us-east-1, on demand, DocumentDB standard storage. They are not read
// from AWS; check the pricing page before quoting a cost.
let documentDbPricing = {
  source: 'assumption: approximate AWS us-east-1 on-demand list prices, standard storage',
  hoursPerMonth: 730,
  storageUsdPerGbMonth: 0.1,
  ioUsdPerMillion: 0.2,
  instances: [
    { name: 'db.t4g.medium', memoryGiB: 4, usdPerHour: 0.073 },
    { name: 'db.r6g.large', memoryGiB: 16, usdPerHour: 0.249 },
    { name: 'db.r6g.xlarge', memoryGiB: 32, usdPerHour: 0.497 },
    { name: 'db.r6g.2xlarge', memoryGiB: 64, usdPerHour: 0.994 },
    { name: 'db.r6g.4xlarge', memoryGiB: 128, usdPerHour: 1.988 },
    { name: 'db.r6g.8xlarge', memoryGiB: 256, usdPerHour: 3.976 },
    { name: 'db.r6g.12xlarge', memoryGiB: 384, usdPerHour: 5.964 },
    { name: 'db.r6g.16xlarge', memoryGiB: 512, usdPerHour: 7.952 }
  ]
};

let horizonsDays = [30, 90, 180, 365, 400];

let gb = 1_000_000_000;

let gib = 1024 ** 3;

let daysPerWeek = 7;

let daysPerMonth = 30.4;

let positive = v.number({ modifiers: [v.minValue(0)] });

let thinHeadroomShare = 0.15;

let sizingNotes = [
  'Not modelled: the content_texts, session_links and source_health collections.',
  'Not modelled: write I/O from slice and session upserts (settle and re-attribution); only record inserts are priced.',
  'Not modelled: backups beyond the free allowance, data transfer, and DocumentDB storage compression.',
  'Retention is applied per collection from event time; shortening it later needs the reconciler job (05 §6).'
];

let sizingInputSchema = v.object({
  label: v.string(),
  kind: v.enumOf(['estimate']),
  developers: v.number({ modifiers: [v.integer(), v.minValue(1)] }),
  sessionsPerDeveloperPerDay: positive,
  workingDaysPerWeek: v.number({ modifiers: [v.minValue(1), v.maxValue(7)] }),
  recordsPerSession: positive,
  bytesPerRecord: positive,
  slicesPerSession: positive,
  bytesPerSlice: positive,
  bytesPerSession: positive,
  retentionDays: v.object({ records: positive, slices: positive, sessions: positive }),
  indexFactor: v.object({ records: positive, slices: positive, sessions: positive }),
  workingSet: v.object({
    recordDays: positive,
    sliceDays: positive,
    sessionDays: positive,
    cacheShareOfMemory: v.number({ modifiers: [v.minValue(0.05), v.maxValue(1)] })
  }),
  instanceCount: v.number({ modifiers: [v.integer(), v.minValue(1)] }),
  ioPerRecordWrite: positive,
  referenceUsdPerDeveloperPerMonth: positive
});

export type SizingInput = ValidationTypeValue<typeof sizingInputSchema>;

type Collection = 'records' | 'slices' | 'sessions';

let collections: Collection[] = ['records', 'slices', 'sessions'];

type StoragePoint = {
  days: number;
  dataGB: Record<Collection, number>;
  indexGB: Record<Collection, number>;
  totalGB: number;
};

type SizingResult = {
  label: string;
  kind: SizingInput['kind'];
  perDay: Record<Collection, number>;
  per100Developers: { horizons: StoragePoint[]; steadyStateGB: number };
  atDevelopers: { developers: number; steadyStateGB: number; workingSetGB: number };
  instance: {
    name: string;
    memoryGiB: number;
    usdPerHour: number;
    fits: boolean;
    neededGiB: number;
    headroomGiB: number;
    thin: boolean;
  };
  monthlyUsd: {
    instances: number;
    storage: number;
    io: number;
    total: number;
    perDeveloper: number;
  };
  costPerDeveloper: { modelled: number; assumedReference: number };
  notes: string[];
  pricing: string;
};

export let parseSizingInput = (value: unknown) =>
  parseWith(sizingInputSchema, 'sizing input', value);

let sessionsPerCalendarDay = (input: SizingInput, developers: number) =>
  (developers * input.sessionsPerDeveloperPerDay * input.workingDaysPerWeek) / daysPerWeek;

export let perDayCounts = (
  input: SizingInput,
  developers: number
): Record<Collection, number> => {
  let sessions = sessionsPerCalendarDay(input, developers);

  return {
    records: sessions * input.recordsPerSession,
    slices: sessions * input.slicesPerSession,
    sessions
  };
};

let bytesPer = (input: SizingInput): Record<Collection, number> => ({
  records: input.bytesPerRecord,
  slices: input.bytesPerSlice,
  sessions: input.bytesPerSession
});

let byCollection = (fn: (collection: Collection) => number) =>
  Object.fromEntries(collections.map(collection => [collection, fn(collection)])) as Record<
    Collection,
    number
  >;

let sum = (values: Record<Collection, number>) =>
  collections.reduce((total, collection) => total + values[collection], 0);

// Retention is a TTL on event time, so after `retention` days each collection stops growing.
export let storageAt = (
  input: SizingInput,
  developers: number,
  days: number
): StoragePoint => {
  let daily = perDayCounts(input, developers);
  let bytes = bytesPer(input);
  let dataGB = byCollection(
    collection =>
      (daily[collection] *
        Math.min(days, input.retentionDays[collection]) *
        bytes[collection]) /
      gb
  );
  let indexGB = byCollection(collection => dataGB[collection] * input.indexFactor[collection]);

  return { days, dataGB, indexGB, totalGB: sum(dataGB) + sum(indexGB) };
};

let steadyDays = (input: SizingInput) =>
  Math.max(
    input.retentionDays.records,
    input.retentionDays.slices,
    input.retentionDays.sessions
  );

let workingSetGB = (input: SizingInput, developers: number) => {
  let steady = storageAt(input, developers, steadyDays(input));
  let daily = perDayCounts(input, developers);
  let bytes = bytesPer(input);
  let hotDays = {
    records: input.workingSet.recordDays,
    slices: input.workingSet.sliceDays,
    sessions: input.workingSet.sessionDays
  };
  let hotData = byCollection(
    collection => (daily[collection] * hotDays[collection] * bytes[collection]) / gb
  );

  return sum(steady.indexGB) + sum(hotData);
};

export let pickInstance = (memoryNeededGiB: number) => {
  let fit = documentDbPricing.instances.find(
    instance => instance.memoryGiB >= memoryNeededGiB
  );
  let instance = fit ?? documentDbPricing.instances[documentDbPricing.instances.length - 1]!;

  return { ...instance, fits: !!fit };
};

export let runSizing = (input: SizingInput): SizingResult => {
  let developers = input.developers;
  let steady = storageAt(input, developers, steadyDays(input));
  let workingSet = workingSetGB(input, developers);
  let neededGiB = (workingSet * gb) / gib / input.workingSet.cacheShareOfMemory;
  let picked = pickInstance(neededGiB);
  let headroomGiB = picked.memoryGiB - neededGiB;
  let instance = {
    ...picked,
    neededGiB,
    headroomGiB,
    thin: !picked.fits || headroomGiB < neededGiB * thinHeadroomShare
  };
  let daily = perDayCounts(input, developers);

  let instances = instance.usdPerHour * documentDbPricing.hoursPerMonth * input.instanceCount;
  let storage = steady.totalGB * documentDbPricing.storageUsdPerGbMonth;
  let io =
    ((daily.records * daysPerMonth * input.ioPerRecordWrite) / 1_000_000) *
    documentDbPricing.ioUsdPerMillion;
  let total = instances + storage + io;
  let perDeveloper = total / developers;

  return {
    label: input.label,
    kind: input.kind,
    perDay: perDayCounts(input, 100),
    per100Developers: {
      horizons: horizonsDays.map(days => storageAt(input, 100, days)),
      steadyStateGB: storageAt(input, 100, steadyDays(input)).totalGB
    },
    atDevelopers: { developers, steadyStateGB: steady.totalGB, workingSetGB: workingSet },
    instance,
    monthlyUsd: { instances, storage, io, total, perDeveloper },
    costPerDeveloper: {
      modelled: perDeveloper,
      assumedReference: input.referenceUsdPerDeveloperPerMonth
    },
    notes: sizingNotes,
    pricing: documentDbPricing.source
  };
};

let fixed = (value: number, digits = 2) => value.toFixed(digits);

export let formatSizing = (result: SizingResult) => {
  let lines = [
    `Sizing: ${result.label} (${result.kind})`,
    '',
    `Per 100 developers, per calendar day: ${Math.round(result.perDay.records).toLocaleString('en-US')} records, ${Math.round(result.perDay.slices).toLocaleString('en-US')} slices, ${Math.round(result.perDay.sessions).toLocaleString('en-US')} sessions`,
    '',
    'Storage per 100 developers (data + indexes, GB):',
    '  days   records   slices  sessions    total'
  ];

  for (let point of result.per100Developers.horizons) {
    let total = (collection: Collection) =>
      point.dataGB[collection] + point.indexGB[collection];
    lines.push(
      `  ${String(point.days).padStart(4)} ${fixed(total('records')).padStart(9)} ${fixed(total('slices')).padStart(8)} ${fixed(total('sessions')).padStart(9)} ${fixed(point.totalGB).padStart(8)}`
    );
  }

  lines.push(
    '',
    `At ${result.atDevelopers.developers} developers: ${fixed(result.atDevelopers.steadyStateGB)} GB at steady state, working set ${fixed(result.atDevelopers.workingSetGB)} GB`,
    `Instance: ${result.instance.name} (${result.instance.memoryGiB} GiB) for ${fixed(result.instance.neededGiB)} GiB needed; headroom ${fixed(result.instance.headroomGiB)} GiB${result.instance.fits ? '' : ' (the working set does not fit the largest class)'}`,
    ...(result.instance.thin
      ? [
          '  Warning: the headroom is thin; a small rise in any input moves the answer to the next class.'
        ]
      : []),
    `Monthly: instances $${fixed(result.monthlyUsd.instances)}, storage $${fixed(result.monthlyUsd.storage)}, I/O $${fixed(result.monthlyUsd.io)}, total $${fixed(result.monthlyUsd.total)} ($${fixed(result.monthlyUsd.perDeveloper)} per developer)`,
    `Cost per developer per month: $${fixed(result.costPerDeveloper.modelled)} modelled, next to $${fixed(result.costPerDeveloper.assumedReference)} as an assumed reference (no threshold is set in the plan or the design docs)`,
    `Prices: ${result.pricing}`,
    '',
    'Notes:',
    ...result.notes.map(note => `  ${note}`)
  );

  return lines.join('\n');
};
