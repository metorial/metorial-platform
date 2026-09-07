import { subDays } from 'date-fns';

export let getCutoffDate = () => subDays(new Date(), 14);
