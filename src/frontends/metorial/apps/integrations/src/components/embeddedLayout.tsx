import type { ReactNode } from 'react';
import { ProgressIndicator } from './progressIndicator';

export let EmbeddedLayout = ({
  currentStep,
  stepLabels,
  children
}: {
  currentStep: number;
  stepLabels: string[];
  children: ReactNode;
}) => (
  <>
    <ProgressIndicator currentStep={currentStep} stepLabels={stepLabels} size="md" />
    <div>{children}</div>
  </>
);
