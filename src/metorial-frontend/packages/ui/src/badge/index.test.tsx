// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Badge, type BadgeProps } from './index';

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

describe('Badge loading state', () => {
  it.each(['1', '2', '3'] as const)(
    'keeps the same indicator slot when a size %s machine badge changes status',
    async size => {
      await act(async () =>
        root.render(
          <Badge color="green" size={size}>
            Running
          </Badge>
        )
      );

      let badge = container.firstElementChild!;
      let indicator = badge.querySelector('[aria-hidden="true"]')!;
      let dot = indicator.querySelector('i');
      let spinner = indicator.querySelector('[title="Loading..."]');
      expect(spinner).not.toBeNull();
      let layers = [...indicator.children];

      for (let loading of [true, false, true, false]) {
        await act(async () =>
          root.render(
            <Badge color={loading ? 'orange' : 'gray'} size={size} loading={loading}>
              {loading ? 'Pausing' : 'Paused'}
            </Badge>
          )
        );

        expect(container.firstElementChild).toBe(badge);
        expect(badge.getAttribute('aria-busy')).toBe(loading ? 'true' : null);
        expect(badge.textContent).toBe(loading ? 'Pausing' : 'Paused');
        expect(badge.querySelector('[aria-hidden="true"]')).toBe(indicator);
        expect([...indicator.children]).toEqual(layers);
        expect(indicator.querySelector('i')).toBe(dot);
        expect(indicator.querySelector('[title="Loading..."]')).toBe(spinner);
        expect(badge.children).toHaveLength(2);
      }
    }
  );

  it.each<BadgeProps>([
    { color: 'blue', icon: <svg />, children: 'Building' },
    { variant: 'connection', tone: 'review', children: 'Review' }
  ])('supports loading on the other badge variants: $children', async props => {
    await act(async () => root.render(<Badge {...props} loading />));

    let badge = container.firstElementChild!;
    expect(badge.getAttribute('aria-busy')).toBe('true');
    expect(badge.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    expect(badge.textContent).toBe(props.children);
  });
});
