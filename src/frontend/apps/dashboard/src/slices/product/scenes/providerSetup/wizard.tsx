import { useWizard, WizardStep } from './index';
import { Stepper } from '../stepper';
import { SelectProviderStep } from './steps/selectProvider';
import { DeploymentDetailsStep } from './steps/deploymentDetails';
import { AuthSetupStep } from './steps/authSetup';

let stepOrder: WizardStep[] = ['selectProvider', 'deploymentDetails', 'authSetup'];

let getStepIndex = (step: WizardStep): number => stepOrder.indexOf(step);

export let ProviderSetupWizard = ({
  instanceId,
  onComplete
}: {
  instanceId: string;
  onComplete: (deploymentId: string) => void;
}) => {
  let { state, setStep } = useWizard();

  let currentStepIndex = getStepIndex(state.step);

  let steps = [
    {
      title: 'Select Provider',
      subtitle: 'Choose a provider from catalog',
      render: () => <SelectProviderStep instanceId={instanceId} />
    },
    {
      title: 'Deployment Details',
      subtitle: 'Name and configure your deployment',
      render: () => <DeploymentDetailsStep instanceId={instanceId} />
    },
    {
      title: 'Authentication',
      subtitle: 'Configure auth settings',
      render: () => (
        <AuthSetupStep
          instanceId={instanceId}
          onComplete={onComplete}
        />
      )
    }
  ];

  let handleSetStep = (index: number) => {
    let newStep = stepOrder[index];
    if (newStep) {
      setStep(newStep);
    }
  };

  return (
    <Stepper steps={steps} currentStep={currentStepIndex} setCurrentStep={handleSetStep} />
  );
};
