export let createListeners = () => {
  let listeners = new Set<Function>();

  let register = (listener: Function) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  let notify = () => {
    for (let listener of listeners) listener();
  };

  let dispose = () => {
    listeners.clear();
  };

  return { register, notify, dispose };
};
