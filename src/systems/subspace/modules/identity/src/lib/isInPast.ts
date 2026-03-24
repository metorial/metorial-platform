export let isInPast = (date: Date) => date.getTime() < Date.now();

export let isInPastOptional = (date?: Date) => (date ? isInPast(date) : false);
