import { isServiceError } from '@metorial/error';
import { toast } from 'sonner';

export let mutation = async <T>(cb: () => Promise<T>) => {
  try {
    let res = await cb();
    return [res, null] as const;
  } catch (err) {
    if (isServiceError(err)) {
      toast.error(err.data.message);
    } else {
      toast.error('An unexpected error occurred.');
    }

    return [null, err as Error] as const;
  }
};
