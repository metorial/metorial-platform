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

export let preventDialogDismissWhenSelectOpen = (event: OutsideInteractionEvent) => {
  if (preventDialogDismissForPointerGesture) {
    event.preventDefault();
    return;
  }

  let target = event.detail?.originalEvent?.target ?? event.target;
  let isSelectInteraction =
    target instanceof Element && target.closest('[data-metorial-select-content]') != null;

  if (isSelectInteraction) event.preventDefault();
};
