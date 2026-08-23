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

// Selects and menus portal out of whatever overlay they were opened from, so interactions with
// them -- and the pointer gesture that closes them -- look like outside interactions.
let nestedOverlaySelector = '[data-metorial-select-content], [data-metorial-menu-content]';

// Radix keeps closing content mounted for the duration of its exit animation, so only content
// that is still open counts as a reason to keep the parent overlay around.
let openNestedOverlaySelector =
  '[data-metorial-select-content][data-state="open"], [data-metorial-menu-content][data-state="open"]';

export let markSelectPointerDismiss = () => {
  preventDialogDismissForPointerGesture = true;
};

export let markOverlayPointerDismiss = markSelectPointerDismiss;

let isNestedOverlayInteraction = (event: OutsideInteractionEvent) => {
  // Radix wraps outside events, so the actual interaction target is on the original event.
  let target = event.detail?.originalEvent?.target ?? event.target;
  return target instanceof Element && target.closest(nestedOverlaySelector) != null;
};

export let preventDialogDismissForSelectInteraction = (event: OutsideInteractionEvent) => {
  if (preventDialogDismissForPointerGesture) {
    event.preventDefault();
    return;
  }

  if (isNestedOverlayInteraction(event)) event.preventDefault();
};

// Popovers sit lower in the layer stack than the menus and selects opened from inside them, so
// they additionally have to ignore the gesture that dismisses the nested overlay -- otherwise a
// single click closes both.
export let preventPopoverDismissForNestedOverlay = (event: OutsideInteractionEvent) => {
  if (preventDialogDismissForPointerGesture || isNestedOverlayInteraction(event)) {
    event.preventDefault();
    return;
  }

  if (typeof document !== 'undefined' && document.querySelector(openNestedOverlaySelector)) {
    event.preventDefault();
  }
};
