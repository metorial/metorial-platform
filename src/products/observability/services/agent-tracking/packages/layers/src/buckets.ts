export type BucketMinutes = 15 | 1440;

let millisPerMinute = 60_000;

export let bucketStart = (date: Date, minutes: BucketMinutes) => {
  let size = minutes * millisPerMinute;

  return new Date(Math.floor(date.getTime() / size) * size);
};

export let bucketEnd = (start: Date, minutes: BucketMinutes) =>
  new Date(start.getTime() + minutes * millisPerMinute);
