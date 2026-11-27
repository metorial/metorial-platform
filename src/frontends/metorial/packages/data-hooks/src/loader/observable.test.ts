import { describe, expect, it, vitest } from 'vitest';
import { Observable } from './observable';

describe('Observable', () => {
  it('should initialize with the provided initial value', () => {
    const initialValue = 42;
    const observable = new Observable(initialValue);
    expect(observable.value).toBe(initialValue);
  });

  it('should update the value and notify subscribers when next is called', () => {
    const observable = new Observable(0);
    const subscriber1 = vitest.fn();
    const subscriber2 = vitest.fn();
    observable.subscribe(subscriber1);
    observable.subscribe(subscriber2);

    const newValue = 10;
    observable.next(newValue);

    expect(observable.value).toBe(newValue);
    expect(subscriber1).toHaveBeenCalledWith(newValue);
    expect(subscriber2).toHaveBeenCalledWith(newValue);
  });

  it('should allow subscribers to unsubscribe', () => {
    const observable = new Observable(0);
    const subscriber1 = vitest.fn();
    const subscriber2 = vitest.fn();
    const unsubscribe1 = observable.subscribe(subscriber1);
    const unsubscribe2 = observable.subscribe(subscriber2);

    const newValue = 5;
    observable.next(newValue);

    expect(subscriber1).toHaveBeenCalledWith(newValue);
    expect(subscriber2).toHaveBeenCalledWith(newValue);

    unsubscribe1();
    observable.next(10);

    expect(subscriber1).toHaveBeenCalledTimes(1);
    expect(subscriber2).toHaveBeenCalledTimes(2);

    unsubscribe2();
    observable.next(15);

    expect(subscriber1).toHaveBeenCalledTimes(1);
    expect(subscriber2).toHaveBeenCalledTimes(2);
  });

  it('should allow subscribing once and automatically unsubscribe after the first notification', () => {
    const observable = new Observable(0);
    const subscriber = vitest.fn();
    observable.subscribeOnce(subscriber);

    const newValue = 20;
    observable.next(newValue);

    expect(subscriber).toHaveBeenCalledWith(newValue);

    observable.next(30);

    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('should correctly determine if there are subscribers', () => {
    const observable = new Observable(0);
    expect(observable.hasSubscribers()).toBe(false);

    const subscriber = vitest.fn();
    let unsub = observable.subscribe(subscriber);
    expect(observable.hasSubscribers()).toBe(true);

    observable.next(10);
    expect(observable.hasSubscribers()).toBe(true);

    observable.subscribeOnce(() => {});
    expect(observable.hasSubscribers()).toBe(true);

    unsub();
    observable.next(20);
    expect(observable.hasSubscribers()).toBe(false);
  });
});
