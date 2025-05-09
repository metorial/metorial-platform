import { useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';

export let useDelayNavigation = (delay: number) => {
  let [delayed, setDelayed] = useState(false);
  let urlRef = useRef<string>(undefined);
  let navigate = useNavigate();

  useBlocker(tx => {
    if (urlRef.current) return false;

    urlRef.current = tx.nextLocation.pathname;
    setDelayed(true);
    setTimeout(
      () =>
        navigate(
          {
            pathname: tx.nextLocation.pathname,
            search: tx.nextLocation.search,
            hash: tx.nextLocation.hash
          },
          { state: tx.nextLocation.state }
        ),
      delay
    );
    return true;
  });

  return delayed;
};
