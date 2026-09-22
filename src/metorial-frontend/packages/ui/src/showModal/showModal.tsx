import React, { useEffect, useRef, useState } from 'react';
import { atom, useAtom } from '../atoms';

let modalAtom = atom<
  {
    id: number;
    component: () => React.ReactElement;
  }[]
>([]);

let currentId = 0;

export let showModal = (
  Body: (d: {
    dialogProps: {
      onOpenChange: (isOpen: boolean) => void;
      isOpen: boolean;
    };
    isOpen: boolean;
    close: () => void;
  }) => React.ReactElement,
  opts: { onClose?: () => void } = {}
) => {
  let id = currentId++;

  let setOpenRef: {
    current: ((isOpen: boolean) => void) | null;
  } = { current: null };

  let hide = () => {
    setOpenRef = { current: null };

    setTimeout(() => {
      modalAtom.set(modals => modals.filter(m => m.id != id));
    }, 500);
  };

  let Component = () => {
    let [open, setOpen] = useState(false);
    setOpenRef.current = setOpen;

    let onCloseInternal = () => {
      setOpen(false);
      hide();
      opts.onClose?.();
    };

    useEffect(
      () => () => {
        setOpenRef.current = null;
      },
      []
    );

    useEffect(() => {
      setTimeout(() => setOpen(true), 2);
    }, []);

    let onOpenChange = (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) onCloseInternal();
    };

    return (
      <Body
        isOpen={open}
        dialogProps={{
          isOpen: open,
          onOpenChange
        }}
        close={onCloseInternal}
      />
    );
  };

  modalAtom.set(modals => [...modals, { id, component: Component }]);

  return {
    close: () => {
      if (setOpenRef.current) setOpenRef.current(false);
      hide();
    }
  };
};

export let ModalRoot = () => {
  let modals = useAtom(modalAtom);
  let pathname = usePathname();

  useEffect(() => {
    modalAtom.set([]);
  }, [pathname]);

  return (
    <>
      {modals.map(m => (
        <m.component key={m.id} />
      ))}
    </>
  );
};

let patchHistoryOnce = (() => {
  let patched = false;

  return () => {
    if (patched || typeof window == 'undefined') return;
    patched = true;

    for (let key of ['pushState', 'replaceState'] as const) {
      let original = window.history[key];
      window.history[key] = function (...args: Parameters<History[typeof key]>) {
        let result = original.apply(this, args);
        window.dispatchEvent(new Event('metorial:locationchange'));
        return result;
      };
    }
  };
})();

let usePathname = () => {
  patchHistoryOnce();

  let [pathname, setPathname] = useState(() =>
    typeof window != 'undefined' ? window.location.pathname : '/'
  );
  let currentPathRef = useRef(pathname);
  currentPathRef.current = pathname;

  useEffect(() => {
    let handler = () => {
      if (currentPathRef.current != window.location.pathname) {
        setPathname(window.location.pathname);
      }
    };

    window.addEventListener('popstate', handler);
    window.addEventListener('metorial:locationchange', handler);

    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('metorial:locationchange', handler);
    };
  }, []);

  return pathname;
};
