export type INavItemPanel = {
  type: 'panel';
  label: string;
  header: {
    title: React.ReactNode;
    description: React.ReactNode;
    background: [string, string, string];
  };
  navs: {
    title?: string;
    links: {
      icon?: React.ReactNode;
      label: React.ReactNode;
      subLabel?: React.ReactNode;
      additionalContent?: React.ReactNode;
      href: string;
      hash?: string;
    }[];
  }[];
  aside?: React.ReactNode;
};

export type INavItemLink = {
  label: string;
  variant?: 'primary' | 'ghost';
} & (
  | {
      type: 'link';
      href: string;
    }
  | {
      type: 'button';
      onClick: () => void;
    }
);

export type INavItem = INavItemLink | INavItemPanel;

export type INav = {
  items: INavItem[];
};
