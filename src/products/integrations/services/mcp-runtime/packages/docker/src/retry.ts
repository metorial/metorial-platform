import axios from 'axios';

let RETRY_ATTEMPTS = 3;
let INITIAL_BACKOFF_MS = 500;

let isTransientError = (err: any): boolean => {
  if (!err) return false;

  if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return true;
  }

  if (axios.isAxiosError(err) && !err.response) {
    return true;
  }

  let status = err.response?.status ?? err.status;
  if (status === 429 || (status >= 500 && status < 600)) {
    return true;
  }

  return false;
};

export let withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  let lastErr: any;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (!isTransientError(err) || attempt === RETRY_ATTEMPTS - 1) {
        throw err;
      }

      let delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastErr;
};
