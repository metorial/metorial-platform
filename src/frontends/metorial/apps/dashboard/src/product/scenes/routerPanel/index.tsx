import { Panel } from '@metorial/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export let RouterPanel = ({
  children,
  param,
  width
}: {
  children: (param: string) => React.ReactNode;
  param: string;
  width?: number;
}) => {
  let [isOpenFor, setIsOpenFor] = useState<string | null>();
  let isOpenForRef = useRef(isOpenFor);

  let location = useLocation();
  let paramValue = useMemo(() => {
    let params = new URLSearchParams(location.search);
    return params.get(param);
  }, [location.search]);

  let contentRef = useRef<any>(undefined);
  if (paramValue) contentRef.current = children(paramValue);

  let navigate = useNavigate();
  useEffect(() => {
    isOpenForRef.current = isOpenFor;
    setIsOpenFor(paramValue ?? null);

    let i = 0;
    let iv = setInterval(() => {
      if (i == 10) clearInterval(iv);
      setIsOpenFor(paramValue ?? null);
      i++;
    }, 50);

    return () => clearInterval(iv);
  }, [paramValue]);

  let isOpen = Boolean(isOpenFor);

  return (
    <Panel.Wrapper
      isOpen={isOpen}
      width={width}
      onOpenChange={v => {
        setIsOpenFor(v && paramValue ? (paramValue as string) : null);

        if (!v || !paramValue) {
          let url = new URL(window.location.href);
          url.searchParams.delete(param);
          navigate(url.pathname + url.search + url.hash, { replace: true });
        }
      }}
    >
      {contentRef.current}
    </Panel.Wrapper>
  );
};
