import { Panel } from '@metorial/ui';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSearchParam } from 'react-use';

export let RouterPanel = ({
  children,
  param,
  width
}: {
  children: (param: string) => React.ReactNode;
  param: string;
  width?: number;
}) => {
  let [isOpen, setIsOpen] = useState(false);

  let [search] = useSearchParams();
  let paramValue = useSearchParam(param);

  let contentRef = useRef<any>(undefined);
  if (paramValue) contentRef.current = children(paramValue);

  let navigate = useNavigate();

  useEffect(() => {
    setIsOpen(!!paramValue);
  }, [paramValue]);

  return (
    <Panel.Wrapper
      isOpen={isOpen}
      width={width}
      onOpenChange={v => {
        setIsOpen(v);

        if (!v) {
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
