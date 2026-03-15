'use client';

import '../config';

import { setAuthRequired } from '@metorial/state';
import { ModalRoot, Toaster } from '@metorial/ui';
import { StyledComponentsRegistry } from '../lib/registry';

setAuthRequired(false);

export let ClientLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <StyledComponentsRegistry>
      {children}

      <ModalRoot />
      <Toaster />
    </StyledComponentsRegistry>
  );
};
