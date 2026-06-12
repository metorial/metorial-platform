import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Menu } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { showCreateIntegrationProviderFirstFlow } from '../integrations/providerPanelFlow';
import { showMagicMcpServerCreateFlow } from '../providerDeployments/magicMcpForm';

type UseProviderButtonProps = {
  providerId: string | undefined | null;
  providerName?: string | null;
  providerDescription?: string | null;
  children?: ReactNode;
  disabled?: boolean;
  size?: '1' | '2' | '3' | '4' | '5';
  variant?: 'solid' | 'outline' | 'soft' | 'ghost';
};

export let UseProviderButton = (p: UseProviderButtonProps) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let isDisabled = p.disabled || !p.providerId || !instance.data;

  return (
    <Menu
      items={[
        {
          id: 'magic-mcp-server',
          label: 'Magic MCP Server',
          description: 'Create a connectable MCP server.'
        },
        {
          id: 'integration',
          label: 'Integration',
          description: 'Create a reusable provider integration.'
        }
      ]}
      onItemClick={item => {
        if (!instance.data || !p.providerId) return;

        if (item === 'magic-mcp-server') {
          showMagicMcpServerCreateFlow({
            instanceId: instance.data.id,
            providerId: p.providerId
          });
          return;
        }

        if (item === 'integration') {
          showCreateIntegrationProviderFirstFlow({
            providerId: p.providerId,
            onCreate: integration => {
              if (!instance.data) return;
              navigate(
                Paths.instance.integration(
                  organization.data,
                  project.data,
                  instance.data,
                  integration.id
                )
              );
            }
          });
        }
      }}
    >
      <Button
        disabled={isDisabled}
        size={p.size ?? '2'}
        variant={p.variant}
        iconRight={<RiArrowDownSLine />}
      >
        {p.children ?? 'Use Provider'}
      </Button>
    </Menu>
  );
};
