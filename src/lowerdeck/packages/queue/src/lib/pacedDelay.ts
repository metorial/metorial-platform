export let pacedDelay = (d: { baseMs: number; jitterMs: number }) => ({
  delay: d.baseMs + Math.floor(Math.random() * d.jitterMs)
});

export let hourlyPacedDelay = () => pacedDelay({ baseMs: 250, jitterMs: 1_250 });

export let dailyPacedDelay = () => pacedDelay({ baseMs: 1_000, jitterMs: 4_000 });
