import React, { useContext, useEffect, useState } from 'react';

export interface DialogState {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;

  autoCloseOnSubmit?: boolean;
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
export let useDialogZIndex = (isOpen: boolean) => {
  let [zIndex, setZIndex] = useState(() => currentZIndexRef.value + 5);

  useEffect(() => {
    currentZIndexRef.value += 10;
    setZIndex(currentZIndexRef.value);
  }, [isOpen]);

  return zIndex;
};

let DialogContext = React.createContext<DialogState | null>(null);
export let DialogProvider = DialogContext.Provider;
export let useDialogContext = () => useContext(DialogContext);
export let useIsInDialog = () => !!useContext(DialogContext);
