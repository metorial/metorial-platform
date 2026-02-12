import React, { createContext, useContext, useState } from 'react';

export type WizardStep = 'selectProvider' | 'deploymentDetails' | 'authSetup';

export type WizardState = {
  providerId: string | null;
  providerName: string | null;
  deploymentId: string | null;
  authConfigId: string | null;
  step: WizardStep;
};

type WizardContextType = {
  state: WizardState;
  setProviderId: (id: string, name: string) => void;
  setDeploymentId: (id: string) => void;
  setAuthConfigId: (id: string | null) => void;
  setStep: (step: WizardStep) => void;
  reset: () => void;
};

let WizardContext = createContext<WizardContextType | null>(null);

let initialState: WizardState = {
  providerId: null,
  providerName: null,
  deploymentId: null,
  authConfigId: null,
  step: 'selectProvider'
};

export let WizardProvider = ({
  children,
  initialProviderId,
  initialProviderName
}: {
  children: React.ReactNode;
  initialProviderId?: string;
  initialProviderName?: string;
}) => {
  let [state, setState] = useState<WizardState>(() => ({
    ...initialState,
    providerId: initialProviderId ?? null,
    providerName: initialProviderName ?? null,
    step: initialProviderId ? 'deploymentDetails' : 'selectProvider'
  }));

  let setProviderId = (id: string, name: string) => {
    setState(prev => ({
      ...prev,
      providerId: id,
      providerName: name,
      step: 'deploymentDetails'
    }));
  };

  let setDeploymentId = (id: string) => {
    setState(prev => ({
      ...prev,
      deploymentId: id,
      step: 'authSetup'
    }));
  };

  let setAuthConfigId = (id: string | null) => {
    setState(prev => ({
      ...prev,
      authConfigId: id
    }));
  };

  let setStep = (step: WizardStep) => {
    setState(prev => ({ ...prev, step }));
  };

  let reset = () => {
    setState(initialState);
  };

  return (
    <WizardContext.Provider
      value={{
        state,
        setProviderId,
        setDeploymentId,
        setAuthConfigId,
        setStep,
        reset
      }}
    >
      {children}
    </WizardContext.Provider>
  );
};

export let useWizard = () => {
  let context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};

export { ProviderSetupWizard } from './wizard';
