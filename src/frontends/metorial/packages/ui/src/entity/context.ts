import { createContext, useContext } from 'react';

export interface EntityContextValue {
  aligned: boolean;
}

export let EntityContext = createContext<EntityContextValue>({ aligned: false });

export let useEntityContext = () => useContext(EntityContext);
