import { LargePanelDialog, ModalRoot, Panel, showModal } from '@metorial/ui';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallbackPanelWrapper } from './callbackPanel';

let root: Root | null = null;

let render = async (node: React.ReactNode) => {
  let container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root!.render(node);
  });

  // Radix defers installation of its pointer-outside listener by one task.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

let appendChildDialog = async () => {
  let childDialog = document.createElement('div');
  childDialog.setAttribute('role', 'dialog');
  childDialog.style.zIndex = '99999';

  let childButton = document.createElement('button');
  childButton.textContent = 'Child dialog action';
  childDialog.appendChild(childButton);

  await act(async () => {
    document.body.appendChild(childDialog);
    await Promise.resolve();
  });

  return { childDialog, childButton };
};

let pointerDown = async (element: HTMLElement) => {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
    );
    element.click();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
};

let focus = async (element: HTMLElement) => {
  await act(async () => {
    element.focus();
  });
};

let escape = async () => {
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true
      })
    );
  });
};

let callbackPanel = (onOpenChange: (open: boolean) => void) => (
  <CallbackPanelWrapper isOpen onOpenChange={onOpenChange}>
    <Panel.Title>Callback panel</Panel.Title>
    <Panel.Description>Callback panel content</Panel.Description>
  </CallbackPanelWrapper>
);

afterEach(async () => {
  vi.useRealTimers();

  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
});

describe('CallbackPanelWrapper', () => {
  it('keeps child-dialog pointer and focus interactions from dismissing the callback panel', async () => {
    let onOpenChange = vi.fn();
    await render(callbackPanel(onOpenChange));
    let { childButton } = await appendChildDialog();

    await pointerDown(childButton);
    await focus(childButton);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('blocks Escape while a child dialog exists', async () => {
    let onOpenChange = vi.fn();
    await render(callbackPanel(onOpenChange));
    await appendChildDialog();

    await escape();

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('keeps dismissal blocked for 500ms after the child dialog tears down', async () => {
    let onOpenChange = vi.fn();
    await render(callbackPanel(onOpenChange));
    let { childDialog } = await appendChildDialog();
    vi.useFakeTimers();

    await act(async () => {
      childDialog.remove();
      await Promise.resolve();
    });
    await escape();

    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await act(async () => {
      vi.advanceTimersByTime(499);
    });
    await escape();

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('allows normal callback-panel dismissal once the teardown delay expires', async () => {
    let onOpenChange = vi.fn();
    await render(callbackPanel(onOpenChange));
    let { childDialog } = await appendChildDialog();
    vi.useFakeTimers();

    await act(async () => {
      childDialog.remove();
      await Promise.resolve();
      vi.advanceTimersByTime(500);
    });
    await escape();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not apply callback stack protection to an ordinary Panel', async () => {
    let onOpenChange = vi.fn();
    await render(
      <Panel.Wrapper isOpen onOpenChange={onOpenChange}>
        <Panel.Title>Ordinary panel</Panel.Title>
        <Panel.Description>Ordinary panel content</Panel.Description>
      </Panel.Wrapper>
    );
    await appendChildDialog();

    await escape();

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('LargePanelDialog', () => {
  it('closes normally when hosted by showModal and ModalRoot', async () => {
    let onClose = vi.fn();
    await render(<ModalRoot />);

    act(() => {
      showModal(
        ({ dialogProps }) => (
          <LargePanelDialog.Wrapper {...dialogProps}>
            <Panel.Title>Large panel</Panel.Title>
            <Panel.Description>Large panel content</Panel.Description>
          </LargePanelDialog.Wrapper>
        ),
        { onClose }
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
    });

    let closeButton = document.querySelector(
      '[role="dialog"] button[aria-label="Close"]'
    ) as HTMLButtonElement;
    vi.useFakeTimers();
    await act(async () => {
      closeButton.click();
    });

    expect(onClose).toHaveBeenCalledOnce();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
  });
});
