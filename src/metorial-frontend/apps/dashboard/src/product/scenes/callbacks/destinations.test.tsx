import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  rotate: vi.fn(),
  onComplete: vi.fn(),
  close: vi.fn()
}));

vi.mock('@metorial/state', () => ({
  useRotateCallbackDestinationSigningSecret: () => ({
    mutate: mocks.rotate,
    isLoading: false,
    RenderError: () => null
  })
}));

import { DestinationSigningSecretModalContent } from './destinations';

let root: Root | null = null;

let renderModal = async () => {
  let container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root!.render(
      <DestinationSigningSecretModalContent
        instanceId="ins_authorized"
        callbackDestinationId="cbd_authorized"
        onComplete={mocks.onComplete}
        close={mocks.close}
      />
    );
  });

  return container;
};

let click = async (element: HTMLElement) => {
  await act(async () => {
    element.click();
  });
};

beforeEach(() => {
  mocks.rotate.mockReset();
  mocks.onComplete.mockReset();
  mocks.close.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
});

describe('DestinationSigningSecretModalContent', () => {
  it('rotates immediately and keeps the returned plaintext only in the open dialog', async () => {
    mocks.rotate.mockResolvedValue([
      {
        object: 'callback.destination.signing_secret#mutation',
        id: 'cbd_authorized',
        signingSecret: 'signing-secret-once'
      },
      null
    ]);
    let container = await renderModal();

    expect(container.textContent).toContain('Rotation takes effect immediately');
    expect(container.textContent).toContain(
      'Existing signature verification will fail as soon as you rotate this secret.'
    );

    let rotateButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Rotate and reveal once')
    )!;
    await click(rotateButton);

    expect(mocks.rotate).toHaveBeenCalledWith({
      instanceId: 'ins_authorized',
      callbackDestinationId: 'cbd_authorized'
    });
    expect(mocks.onComplete).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('signing-secret-once');
    expect(container.textContent).toContain(
      'The previous signing secret was invalidated immediately.'
    );
    expect(container.querySelector('[aria-label="Copy Signing secret"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Rotate and reveal once');

    let doneButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Done'
    )!;
    await click(doneButton);
    expect(mocks.close).toHaveBeenCalledOnce();

    await act(async () => root!.unmount());
    root = null;
    expect(document.body.textContent).not.toContain('signing-secret-once');
  });
});
