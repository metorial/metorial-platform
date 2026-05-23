export let getUtcOffsetInMinutes = (utc: string) => {
  let sign = utc[0] == '-' ? -1 : 1;
  let [hours, minutes] = utc.slice(1).split(':').map(Number);
  return sign * (hours * 60 + minutes);
};
