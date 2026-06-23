import { describe, expect, it, vitest } from 'vitest';
import { atom } from './atom';

describe('atom', () => {
  it('should set and get the value', () => {
    const initialValue = 10;
    const myAtom = atom(initialValue);

    expect(myAtom.get()).toBe(initialValue);

    const newValue = 20;
    myAtom.set(newValue);

    expect(myAtom.get()).toBe(newValue);
  });

  it('should update the value using a function', () => {
    const initialValue = 10;
    const myAtom = atom(initialValue);

    expect(myAtom.get()).toBe(initialValue);

    const increment = (value: number) => value + 1;
    myAtom.set(increment);

    expect(myAtom.get()).toBe(initialValue + 1);
  });

  it('should notify subscribers when the value changes', () => {
    const initialValue = 10;
    const myAtom = atom(initialValue);

    const subscriber = vitest.fn();
    myAtom.subscribe(subscriber);

    const newValue = 20;
    myAtom.set(newValue);

    expect(subscriber).toHaveBeenCalledWith(newValue);
  });
});
