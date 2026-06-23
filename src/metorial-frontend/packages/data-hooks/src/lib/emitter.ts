export let createStateEmitter = () => {
  let currentIndex = 0;

  // We store listeners and resources in a map so that we can easily
  // manage bulk listeners, without notifying them multiple times.
  let listeners = new Map<number, Function>();
  let resources = new Map<string, Set<number>>();

  let register = (resourceIds: string[], listener: Function) => {
    let index = currentIndex++;
    listeners.set(index, listener);

    for (let resourceId of resourceIds) {
      let set = resources.get(resourceId);
      if (!set) {
        set = new Set();
        resources.set(resourceId, set);
      }

      set.add(index);
    }

    return () => {
      for (let resourceId of resourceIds) {
        let set = resources.get(resourceId);
        if (set) {
          set.delete(index);
          if (set.size == 0) resources.delete(resourceId);
        }
      }
    };
  };

  let notify = (resourceIds: string[]) => {
    // We use a set to avoid notifying the same listener multiple times.
    let listenersToNotify = new Set<number>();

    for (let resourceId of resourceIds) {
      let set = resources.get(resourceId);
      if (set) {
        for (let index of set) listenersToNotify.add(index);
      }
    }

    for (let index of listenersToNotify) {
      let listener = listeners.get(index);
      if (listener) listener();
    }

    return {
      didNotify: listenersToNotify.size > 0
    };
  };

  return { register, notify };
};
