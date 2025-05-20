import { useRouter, useSearchParams } from 'next/navigation';
import React, { createContext, useEffect, useState } from 'react';
import { FullServer, ListServer } from '../../../../../../../state/server';

let Context = createContext<{
  openState: [boolean, React.Dispatch<React.SetStateAction<boolean>>] | null;
  serverInstanceState:
    | [string | undefined, React.Dispatch<React.SetStateAction<string | undefined>>]
    | null;
}>({
  openState: null,
  serverInstanceState: null
});

export let ExplorerContextProvider = ({ children }: { children: React.ReactNode }) => {
  let openState = useState(false);
  let serverInstanceState = useState<string | undefined>(undefined);

  let router = useRouter();

  let search = useSearchParams();
  let searchExplorer = search.get('explorer');
  let searchInstance = search.get('instance');

  useEffect(() => {
    if (searchExplorer) openState[1](searchExplorer == 'true');
    if (searchInstance) serverInstanceState[1](searchInstance);

    let newSearch = new URLSearchParams(window.location.search);
    newSearch.delete('explorer');
    newSearch.delete('instance');

    router.replace(
      `${window.location.pathname}${window.location.search ? '?' : ''}${newSearch.toString()}`,
      {}
    );
  }, [searchExplorer, searchInstance]);

  return (
    <Context.Provider value={{ openState, serverInstanceState }}>{children}</Context.Provider>
  );
};

export let useExplorerState = () => {
  let context = React.useContext(Context);
  if (!context.openState || !context.serverInstanceState)
    throw new Error('useExplorerContext must be used within ExplorerContext');

  return context.openState;
};

export let useExplorer = (server: FullServer | ListServer) => {
  let context = React.useContext(Context);
  let setOpen = context.openState?.[1];
  let setServerInstance = context.serverInstanceState?.[1];
  let router = useRouter();

  return {
    open: (instance?: { id: string; server: { id: string } }) => {
      if (setOpen && setServerInstance && (!instance || server.id == instance.server.id)) {
        setOpen(true);
        if (instance) setServerInstance(instance.id);
      } else {
        let url = `/s/${server.vendor.slug}/${server.slug}/?explorer=true`;
        if (instance) url += `&instance=${instance.id}`;
        router.push(url);
      }
    }
  };
};
