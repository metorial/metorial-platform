import { Button, Menu, Tooltip } from '@metorial/ui';
import type { ButtonSize } from '@metorial/ui';
import type { ReactNode } from 'react';
import { useProviderAuthCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { getCreateMethodDescription } from './modalHelpers';
import {
  ProviderAuthConfigCreateModalProps,
  showProviderAuthConfigCreateModal
} from './createModal';

export let ProviderAuthConfigCreateButton = (
  p: Omit<ProviderAuthConfigCreateModalProps, 'initialAuthMethodId'> & {
    size?: ButtonSize;
    iconLeft?: ReactNode;
    children: ReactNode;
    ariaLabel?: string;
    disabled?: boolean;
  }
) => {
  let authCreation = useProviderAuthCreationCapabilities(
    p.instanceId,
    p.providerDeploymentId,
    p.providerId
  );

  let openCreateFlow = (authMethodId: string) =>
    showProviderAuthConfigCreateModal({
      instanceId: p.instanceId,
      providerDeploymentId: p.providerDeploymentId,
      providerId: p.providerId,
      initialAuthMethodId: authMethodId,
      onCreate: p.onCreate,
      onBack: p.onBack
    });

  if (p.disabled || !authCreation.canCreateAuthConfig) {
    return (
      <Tooltip
        content={authCreation.authConfigDisabledReason ?? ''}
        enabled={!p.disabled && !authCreation.canCreateAuthConfig}
        delayDuration={0}
      >
        <div style={{ display: 'inline-flex' }}>
          <Button
            type="button"
            size={p.size}
            iconLeft={p.iconLeft}
            aria-label={p.ariaLabel}
            disabled
          >
            {p.children}
          </Button>
        </div>
      </Tooltip>
    );
  }

  if (authCreation.authMethodItems.length <= 1) {
    return (
      <Button
        type="button"
        size={p.size}
        iconLeft={p.iconLeft}
        aria-label={p.ariaLabel}
        disabled={p.disabled}
        onClick={() => openCreateFlow(authCreation.authMethodItems[0]!.id)}
      >
        {p.children}
      </Button>
    );
  }

  return (
    <Menu
      label={typeof p.children === 'string' ? p.children : p.ariaLabel}
      title="Choose authentication method"
      items={authCreation.authMethodItems.map(method => ({
        id: method.id,
        label: method.name,
        description: getCreateMethodDescription(method)
      }))}
      onItemClick={authMethodId => openCreateFlow(authMethodId)}
    >
      <Button
        type="button"
        size={p.size}
        iconLeft={p.iconLeft}
        aria-label={p.ariaLabel}
        disabled={p.disabled}
      >
        {p.children}
      </Button>
    </Menu>
  );
};
