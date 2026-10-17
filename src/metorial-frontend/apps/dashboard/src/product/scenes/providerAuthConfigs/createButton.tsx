import { Button, Menu, Tooltip } from '@metorial/ui';
import type { ButtonSize } from '@metorial/ui';
import type { ReactNode } from 'react';
import type { ProviderAuthConfigCreateModalProps } from './createModal';
import { getCreateMethodDescription } from './modalHelpers';
import { useProviderAuthConfigAuthenticateAction } from './useAuthenticateAction';

export let ProviderAuthConfigCreateButton = (
  p: Omit<ProviderAuthConfigCreateModalProps, 'initialAuthMethodId'> & {
    fixedAuthMethodId?: string;
    size?: ButtonSize;
    iconLeft?: ReactNode;
    children: ReactNode;
    ariaLabel?: string;
    disabled?: boolean;
  }
) => {
  let authenticate = useProviderAuthConfigAuthenticateAction({
    instanceId: p.instanceId,
    providerDeploymentId: p.providerDeploymentId,
    providerId: p.providerId,
    fixedAuthMethodId: p.fixedAuthMethodId,
    fixedAuthCredentialsId: p.fixedAuthCredentialsId,
    authMethodAdapter: p.authMethodAdapter,
    defaultAuthConfigName: p.defaultAuthConfigName,
    onCreate: p.onCreate,
    onBack: p.onBack
  });
  let authCreation = authenticate.authCreation;
  let openCreateFlow = authenticate.start;

  if (p.fixedAuthMethodId) {
    return (
      <Button
        type="button"
        size={p.size}
        iconLeft={p.iconLeft}
        aria-label={p.ariaLabel}
        disabled={p.disabled}
        loading={authenticate.isLoading}
        onClick={() => openCreateFlow(p.fixedAuthMethodId!)}
      >
        {p.children}
      </Button>
    );
  }

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
        loading={authenticate.isLoading}
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
        loading={authenticate.isLoading}
      >
        {p.children}
      </Button>
    </Menu>
  );
};
