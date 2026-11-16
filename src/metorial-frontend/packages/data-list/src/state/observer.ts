import equal from 'fast-deep-equal';

type Callback<T> = (value: T) => void;
type FilterFunction<T> = (value: T) => boolean;
type FilterFunctionAsync<T> = (value: T) => boolean | Promise<boolean>;
type MapFunction<T, U> = (value: T) => U;
type MapFunctionAsync<T, U> = (value: T) => U | Promise<U>;

export class Observer<T> {
  #subscribers: Callback<T>[] = [];
  #completed: boolean = false;
  #lastValue: T | undefined;

  get lastValue() {
    return this.#lastValue;
  }

  get completed() {
    return this.#completed;
  }

  subscribe(callback: Callback<T>) {
    this.#subscribers.push(callback);

    // if (this.#lastValue !== undefined) {
    //   callback(this.#lastValue);
    // }

    return () => {
      this.unsubscribe(callback);
    };
  }

  subscribeWithInitial(callback: Callback<T>) {
    this.#subscribers.push(callback);

    if (this.#lastValue !== undefined) callback(this.#lastValue);

    return () => {
      this.unsubscribe(callback);
    };
  }

  unsubscribe(callback: Callback<T>) {
    this.#subscribers = this.#subscribers.filter(subscriber => subscriber != callback);
  }

  complete() {
    if (!this.#completed) {
      this.#completed = true;
      this.#subscribers = [];
    }
  }

  notify(value: T) {
    if (!this.#completed) {
      this.#lastValue = value;
      this.#subscribers.forEach(subscriber => subscriber(value));
    }
  }

  filter(filterFn: FilterFunction<T>) {
    let filteredObserver = new Observer<T>();

    this.subscribe(value => {
      let filterValue = filterFn(value);

      if (filterValue) {
        filteredObserver.notify(value);
      }
    });

    return filteredObserver;
  }

  map<U>(mapFn: MapFunction<T, U>) {
    let mappedObserver = new Observer<U>();

    this.subscribe(value => {
      let mappedValue = mapFn(value);
      mappedObserver.notify(mappedValue);
    });

    return mappedObserver;
  }

  once(callback: Callback<T>) {
    let unsubscribe = this.subscribe(value => {
      callback(value);
      unsubscribe();
    });
  }

  clear() {
    this.#subscribers = [];
  }

  merge(...observers: Observer<T>[]) {
    let mergedObserver = new Observer<T>();

    for (let observer of [this, ...observers]) {
      observer.subscribe(value => mergedObserver.notify(value));
    }

    return mergedObserver;
  }

  combine<A, B = void, C = void, D = void, E = void>(
    observerA: Observer<A>,
    observerB?: Observer<B>,
    observerC?: Observer<C>,
    observerD?: Observer<D>,
    observerE?: Observer<E>
  ) {
    let combinedObserver = new Observer<[T, A, B, C, D, E]>();

    let observers = [this, observerA, observerB, observerC, observerD, observerE].filter(
      Boolean
    ) as Observer<any>[];

    combinedObserver.#lastValue = observers.map(observer => observer.lastValue) as any;

    for (let observer of observers) {
      observer.subscribe(value => {
        let values = observers.map(observer => observer.lastValue);
        combinedObserver.notify(values as any);
      });
    }

    return combinedObserver;
  }

  take(count: number): Observer<T> {
    let takenObserver = new Observer<T>();
    let currentCount = 0;

    let unsubscribe = this.subscribe(value => {
      takenObserver.notify(value);
      currentCount++;

      if (currentCount >= count) {
        takenObserver.complete();
        unsubscribe();
      }
    });

    return takenObserver;
  }

  debounce(time: number, { maxWait }: { maxWait?: number } = {}) {
    let timerId: NodeJS.Timeout | undefined;
    let lastCallTime = 0;
    let debouncedObserver = new Observer<T>();

    let clearTimer = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = undefined;
      }
    };

    this.subscribe(value => {
      let currentTime = Date.now();
      let timeSinceLastCall = currentTime - lastCallTime;
      lastCallTime = currentTime;

      clearTimer();

      if (maxWait && timeSinceLastCall >= maxWait) {
        debouncedObserver.notify(value);
      } else {
        timerId = setTimeout(() => {
          debouncedObserver.notify(value);
          clearTimer();
        }, time) as any;
      }
    });

    return debouncedObserver;
  }

  throttle(time: number) {
    let lastNotificationTime: number = 0;
    let throttledObserver = new Observer<T>();

    this.subscribe(value => {
      let currentTime = Date.now();
      if (currentTime - lastNotificationTime >= time) {
        throttledObserver.notify(value);
        lastNotificationTime = currentTime;
      }
    });

    return throttledObserver;
  }

  ignoreUntilChanged(): Observer<T> {
    let previousValue: T | undefined;
    let distinctObserver = new Observer<T>();

    this.subscribe(value => {
      if (value == previousValue || !equal(value, previousValue)) {
        distinctObserver.notify(value);
        previousValue = value;
      }
    });

    return distinctObserver;
  }

  static of = <T>(...value: T[]) => {
    let observer = new Observer<T>();

    // Delay events so that subscribers can
    // subscribe before the first event is emitted
    setTimeout(() => {
      value.forEach(v => observer.notify(v));
    }, 0);

    return observer;
  };

  static merge<T>(...observers: Observer<T>[]) {
    return new Observer<T>().merge(...observers);
  }
}
