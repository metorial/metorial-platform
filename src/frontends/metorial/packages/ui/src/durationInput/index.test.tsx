// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DurationInput } from './index';

vi.mock('../menu', () => ({ Menu: () => null }));
vi.mock('../switch', () => ({ Switch: () => null }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it.each([300, 3600, 90])(
  'does not block form submission for %s seconds with a converted minimum',
  async value => {
    await act(async () =>
      root.render(
        <form>
          <DurationInput label="Idle Timeout" value={value} min={10} onChange={vi.fn()} />
        </form>
      )
    );

    expect(container.querySelector('form')!.checkValidity()).toBe(true);
    expect(container.querySelector('input[type="number"]')!.getAttribute('step')).toBe('any');
  }
);

it('still enforces the minimum duration', async () => {
  await act(async () =>
    root.render(
      <form>
        <DurationInput label="Idle Timeout" value={5} min={10} onChange={vi.fn()} />
      </form>
    )
  );

  expect(container.querySelector('form')!.checkValidity()).toBe(false);
});
