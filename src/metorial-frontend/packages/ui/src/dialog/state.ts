import React, { useContext, useEffect, useState } from 'react';

export interface DialogState {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  autoCloseOnSubmit?: boolean;
  contentRef?: React.RefObject<HTMLElement | null>;
}

export let useDialog = (initialState = false) => {
  let [isOpen, setIsOpen] = useState(initialState);

  return {
    state: {
      isOpen,
      onOpenChange: setIsOpen
    } as DialogState,
    isOpen,
    open: () => setIsOpen(true)
  };
};

let currentZIndexRef = { value: 1000 };
export let useZindex = (isOpen: boolean) => {
  let [zIndex, setZIndex] = useState(() => currentZIndexRef.value + 5);

  useEffect(() => {
    currentZIndexRef.value += 10;
    setZIndex(currentZIndexRef.value);
  }, [isOpen]);

  return zIndex;
};

export let useZIndex = useZindex;
export let useDialogZIndex = useZindex;

let DialogContext = React.createContext<DialogState | null>(null);
export let DialogProvider = DialogContext.Provider;
export let useDialogContext = () => useContext(DialogContext);
export let useIsInDialog = () => !!useContext(DialogContext);

type OutsideInteractionEvent = Event & {
  detail?: {
    originalEvent?: Event;
  };
};

// Radix Select disables pointer events outside its portal. When it closes, the remainder of
// that pointer gesture can be retargeted to a parent dialog overlay after the Select has
// already unmounted. Keep the guard alive for that gesture, then clear it before the next one.
let preventDialogDismissForPointerGesture = false;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    () => {
      preventDialogDismissForPointerGesture = false;
    },
    true
  );
}

export let markSelectPointerDismiss = () => {
  preventDialogDismissForPointerGesture = true;
};

export let preventDialogDismissForSelectInteraction = (event: OutsideInteractionEvent) => {
  if (preventDialogDismissForPointerGesture) {
    event.preventDefault();
    return;
  }

  // Radix wraps outside events, so the actual interaction target is on the original event.
  let target = event.detail?.originalEvent?.target ?? event.target;
  let isSelectInteraction =
    target instanceof Element && target.closest('[data-metorial-select-content]') != null;

  if (isSelectInteraction) event.preventDefault();
};
