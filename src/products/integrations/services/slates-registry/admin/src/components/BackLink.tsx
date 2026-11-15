import { Link } from 'react-router-dom';
import { Button } from '@metorial-io/ui';
import { RiArrowLeftLine } from '@remixicon/react';

type BackLinkProps = {
  to: string;
  children: React.ReactNode;
};

export let BackLink = ({ to, children }: BackLinkProps) => {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <Button as="span" variant="ghost" size="2" iconLeft={<RiArrowLeftLine size={16} />}>
        {children}
      </Button>
    </Link>
  );
};
