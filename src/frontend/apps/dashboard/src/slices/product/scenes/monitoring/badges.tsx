import { Badge } from '@metorial/ui';

export let MonitorAlertStatusBadge = ({ status }: { status: string }) => {
  let colors: Record<string, 'orange' | 'green' | 'gray'> = {
    pending: 'orange',
    resolved: 'green',
    ignored: 'gray'
  };

  let labels: Record<string, string> = {
    pending: 'Pending',
    resolved: 'Resolved',
    ignored: 'Ignored'
  };

  return <Badge color={colors[status] ?? 'gray'}>{labels[status] ?? status}</Badge>;
};

export let MonitorStatusBadge = ({ status }: { status: string }) => {
  return (
    <Badge color={status === 'active' ? 'green' : 'gray'}>
      {status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : status}
    </Badge>
  );
};

export let MonitorTargetBadge = ({ target }: { target: string }) => {
  return (
    <Badge color={target === 'protoguard_filter' ? 'purple' : 'blue'}>
      {target === 'protoguard_filter' ? 'ProtoGuard Filter' : 'Schema Change'}
    </Badge>
  );
};

export let MonitorOwnerBadge = ({ owner }: { owner: string }) => {
  return <Badge color={owner === 'system' ? 'gray' : 'blue'}>{owner}</Badge>;
};

export let ProtoGuardSeverityBadge = ({ severity }: { severity: string }) => {
  let colors: Record<string, 'gray' | 'blue' | 'orange' | 'red'> = {
    low: 'gray',
    medium: 'blue',
    high: 'orange',
    critical: 'red'
  };

  return <Badge color={colors[severity] ?? 'gray'}>{severity}</Badge>;
};
