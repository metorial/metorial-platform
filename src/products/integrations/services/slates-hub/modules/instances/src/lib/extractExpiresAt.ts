let BEGINNING_OF_TIME = new Date(2026, 0, 1);

export let extractExpiresAt = (input: { expiresAt?: unknown }) => {
  try {
    let data = new Date(input.expiresAt as string | number);
    if (Number.isNaN(data.getTime())) throw new Error('Invalid date');

    // It's probably in seconds
    if (data < BEGINNING_OF_TIME) {
      data = new Date(data.getTime() * 1000);
    }

    return data;
  } catch {}

  return null;
};
