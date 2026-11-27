import React, { useContext, useEffect, useMemo, useState } from 'react';

let OverlayOpenContext = React.createContext(false);

export let OverlayOpenProvider = OverlayOpenContext.Provider;

export let useIsInsideOpenOverlay = () => useContext(OverlayOpenContext);

export interface TooltipSuppressor {
  hold: () => () => void;
}

let TooltipSuppressorContext = React.createContext<TooltipSuppressor | null>(null);

export let TooltipSuppressorProvider = TooltipSuppressorContext.Provider;

export let useTooltipSuppressor = () => {
  let [holds, setHolds] = useState(0);

  let suppressor = useMemo<TooltipSuppressor>(
    () => ({
      hold: () => {
        setHolds(holds => holds + 1);
        let isReleased = false;

        return () => {
          if (isReleased) return;
          isReleased = true;
          setHolds(holds => holds - 1);
        };
      }
    }),
    []
  );

  return { isHeld: holds > 0, suppressor };
};

export let useSuppressTooltipWhileOpen = (isOpen: boolean) => {
  let suppressor = useContext(TooltipSuppressorContext);

  useEffect(() => {
    if (!isOpen) return;
    return suppressor?.hold();
  }, [isOpen, suppressor]);
};
