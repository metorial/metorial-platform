import { useEffect, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate } from 'react-router-dom';

export let useDelayNavigation = (delay: number) => {
  let [delayed, setDelayed] = useState(false);
  let urlRef = useRef<string>(undefined);
  let location = useLocation();
  let navigate = useNavigate();

  let currentUrl = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (urlRef.current != currentUrl) return;

    urlRef.current = undefined;
    setDelayed(false);
  }, [currentUrl]);

  useBlocker(tx => {
    if (urlRef.current) return false;

    urlRef.current = `${tx.nextLocation.pathname}${tx.nextLocation.search}${tx.nextLocation.hash}`;
    setDelayed(true);
    setTimeout(
      () =>
        navigate(
          {
            pathname: tx.nextLocation.pathname,
            search: tx.nextLocation.search,
            hash: tx.nextLocation.hash
          },
          { replace: tx.historyAction == 'REPLACE', state: tx.nextLocation.state }
        ),
      delay
    );
    return true;
  });

  return delayed;
};
