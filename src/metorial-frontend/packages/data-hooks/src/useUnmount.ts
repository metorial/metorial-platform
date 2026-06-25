import { useEffect, useRef } from 'react';

export let useUnmount = (cb: () => void) => {
  let cbRef = useRef(cb);
  cbRef.current = cb;

  let rendered = useRef(true);
  rendered.current = true;

  useEffect(() => {
    rendered.current = true;

    return () => {
      rendered.current = false;

      setTimeout(() => {
        if (!rendered.current) cbRef.current();
      }, 1000);
    };
  }, []);
};
