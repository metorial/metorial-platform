import { Badge, Text } from '@metorial/ui';

export let formatAuthConfigType = (type: string | null | undefined) => {
  if (type === 'oauth_automated') return 'OAuth (Automated)';
  if (type === 'oauth_manual') return 'OAuth (Manual)';
  if (type === 'manual') return 'Manual';
  return '—';
};

export let formatAuthConfigSource = (source: string | null | undefined) => {
  if (source === 'setup_session') return 'Setup Session';
  if (source === 'system') return 'System';
  if (source === 'manual') return 'Manual';
  return '—';
};

export let renderCapabilityStatus = (status: string | null | undefined) => {
  if (status === 'enabled' || status === 'active') {
    return <Badge color="green">{status}</Badge>;
  }

  if (status === 'supported') {
    return <Badge color="green">supported</Badge>;
  }

  if (status === 'encrypted') {
    return <Badge color="blue">encrypted</Badge>;
  }

  if (status === 'disabled' || status === 'archived' || status === 'unsupported') {
    return <Badge color="gray">{status}</Badge>;
  }

  return <Text size="2">—</Text>;
};
