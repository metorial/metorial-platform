import React, { createContext, useContext } from 'react';

let PaginationSearchParamsContext = createContext(false);

export let PaginationSearchParamsProvider = ({
  enabled,
  children
}: {
  enabled: boolean;
  children: React.ReactNode;
}) => {
  return (
    <PaginationSearchParamsContext.Provider value={enabled}>
      {children}
    </PaginationSearchParamsContext.Provider>
  );
};

export let usePaginationSearchParamsEnabled = () => {
  return useContext(PaginationSearchParamsContext);
};
