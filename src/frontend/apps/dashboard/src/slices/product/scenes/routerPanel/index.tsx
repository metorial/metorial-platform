import { Panel } from '@metorial/ui';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterval, useSearchParam } from 'react-use';

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

  let paramValue = useSearchParam(param);

  let contentRef = useRef<any>(undefined);
  if (paramValue) contentRef.current = children(paramValue);

  let navigate = useNavigate();
  useEffect(() => {
    isOpenForRef.current = isOpenFor;
    setIsOpenFor(paramValue ?? null);
  }, [paramValue]);

  useInterval(() => {
    if (paramValue && isOpenForRef.current != paramValue) {
      setIsOpenFor(paramValue);
    }
  }, 150);

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
