let errorListeners: ((error: Error) => void)[] = [];
let onToast: ((level: 'info' | 'error' | 'success', message: string) => any) | undefined;

export let setMetorialReactHandlersGlobal = (input: {
  onError?: (error: Error) => any;
  onToast?: (level: 'info' | 'error' | 'success', message: string) => any;
}) => {
  if (input.onError) errorListeners.push(input.onError);
  if (input.onToast) onToast = input.onToast;
};

export let toast = (level: 'info' | 'error' | 'success', message: string) => {
  if (onToast) onToast(level, message);
};

export let onError = (error: Error) => {
  for (let listener of errorListeners) listener(error);
};
