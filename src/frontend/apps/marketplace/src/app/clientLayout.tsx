'use client';

import '../config';

import { setAuthRequired } from '@metorial/state';
import { ModalRoot, Toaster } from '@metorial/ui';
import { StyledComponentsRegistry } from '../lib/registry';
import { EarlyAccessBar } from './marketplace/components/earlyAccess';

setAuthRequired(false);

export let ClientLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <StyledComponentsRegistry>
      {children}

      <ModalRoot />
      <Toaster />

      {process.env.SHOW_EARLY_ACCESS_BAR == 'true' && <EarlyAccessBar />}
    </StyledComponentsRegistry>
  );
};
