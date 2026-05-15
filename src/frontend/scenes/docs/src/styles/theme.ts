export type Theme = {
  name: 'light';
  color: {
    bg: string;
    bgAlt: string;
    bgElevated: string;
    bgHover: string;
    bgActive: string;
    border: string;
    borderStrong: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    accent: string;
    accentHover: string;
    accentSoft: string;
    danger: string;
    warning: string;
    success: string;
    info: string;
    code: string;
    codeBg: string;
    selection: string;
    shadow: string;
    callout: {
      info: { bg: string; border: string; text: string };
      warning: { bg: string; border: string; text: string };
      success: { bg: string; border: string; text: string };
      danger: { bg: string; border: string; text: string };
    };
  };
  font: {
    sans: string;
    serif: string;
    mono: string;
  };
  size: {
    radius: string;
    radiusLg: string;
    radiusSm: string;
    toolbarHeight: string;
    sidebarWidth: string;
    contentWidth: string;
  };
  shadow: {
    sm: string;
    md: string;
    lg: string;
  };
  motion: {
    fast: string;
    base: string;
    slow: string;
  };
};

export let lightTheme: Theme = {
  name: 'light',
  color: {
    bg: '#ffffff',
    bgAlt: '#fafaf9',
    bgElevated: '#ffffff',
    bgHover: 'rgba(55, 53, 47, 0.06)',
    bgActive: 'rgba(55, 53, 47, 0.10)',
    border: 'rgba(55, 53, 47, 0.10)',
    borderStrong: 'rgba(55, 53, 47, 0.20)',
    text: '#000000',
    textMuted: 'rgba(55, 53, 47, 0.65)',
    textSubtle: 'rgba(55, 53, 47, 0.45)',
    accent: '#2383e2',
    accentHover: '#1a73c7',
    accentSoft: 'rgba(35, 131, 226, 0.10)',
    danger: '#e03e3e',
    warning: '#d9730d',
    success: '#0f7b6c',
    info: '#0b6e99',
    code: '#eb5757',
    codeBg: 'rgba(135, 131, 120, 0.15)',
    selection: 'rgba(35, 131, 226, 0.28)',
    shadow: 'rgba(15, 15, 15, 0.10)',
    callout: {
      info: {
        bg: 'rgba(35, 131, 226, 0.08)',
        border: 'rgba(35, 131, 226, 0.30)',
        text: '#0b6e99'
      },
      warning: {
        bg: 'rgba(217, 115, 13, 0.08)',
        border: 'rgba(217, 115, 13, 0.30)',
        text: '#d9730d'
      },
      success: {
        bg: 'rgba(15, 123, 108, 0.08)',
        border: 'rgba(15, 123, 108, 0.30)',
        text: '#0f7b6c'
      },
      danger: {
        bg: 'rgba(224, 62, 62, 0.08)',
        border: 'rgba(224, 62, 62, 0.30)',
        text: '#e03e3e'
      }
    }
  },
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif',
    serif: '"Lyon Text", Georgia, ui-serif, serif',
    mono: '"JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", monospace'
  },
  size: {
    radius: '6px',
    radiusLg: '12px',
    radiusSm: '4px',
    toolbarHeight: '46px',
    sidebarWidth: '260px',
    contentWidth: '1000px'
  },
  shadow: {
    sm: '0 1px 2px rgba(15, 15, 15, 0.05), 0 1px 3px rgba(15, 15, 15, 0.06)',
    md: '0 4px 12px rgba(15, 15, 15, 0.10), 0 1px 3px rgba(15, 15, 15, 0.05)',
    lg: '0 12px 32px rgba(15, 15, 15, 0.12), 0 4px 8px rgba(15, 15, 15, 0.06)'
  },
  motion: {
    fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '180ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '280ms cubic-bezier(0.4, 0, 0.2, 1)'
  }
};
