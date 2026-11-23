// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommitNumberInput } from './commitInput';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@metorial/ui', () => ({
  NumberInput: ({ value, onChange }: any) => (
    <input
      value={value ?? ''}
      onChange={event =>
        onChange(event.target.value === '' ? null : Number(event.target.value))
      }
    />
  )
}));

let container: HTMLDivElement;
let root: Root;
let navigate: NavigateFunction;
let onCommit = vi.fn();

let Harness = ({ value }: { value: number }) => {
  navigate = useNavigate();
  return (
    <CommitNumberInput label="Threshold" value={value} min={0} max={100} onCommit={onCommit} />
  );
};

let render = (value: number) =>
  act(() =>
    root.render(
      <MemoryRouter>
        <Harness value={value} />
      </MemoryRouter>
    )
  );

let input = () => container.querySelector('input')!;

let type = (text: string) =>
  act(() => {
    input().focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input(),
      text
    );
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });

let press = (key: string) =>
  act(() => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });

let blur = () => act(() => input().blur());

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  onCommit.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('CommitNumberInput', () => {
  it('commits the clamped value on Enter and shows it', () => {
    render(80);
    type('500');
    expect(onCommit).not.toHaveBeenCalled();

    press('Enter');
    expect(onCommit).toHaveBeenCalledWith(100);
    expect(input().value).toBe('100');
  });

  it('commits on blur and restores the value when the field is left empty', () => {
    render(80);
    type('50');
    blur();
    expect(onCommit).toHaveBeenCalledWith(50);

    onCommit.mockReset();
    type('');
    blur();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe('80');
  });

  it('shows the new value when the value or the location changes', () => {
    render(80);
    type('50');
    render(30);
    expect(input().value).toBe('30');

    type('50');
    act(() => navigate('?view=practices'));
    expect(input().value).toBe('30');
  });
});
