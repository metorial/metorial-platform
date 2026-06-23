import type { SVGProps } from 'react';

let Svg = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  />
);

export let IconBold = () => (
  <Svg>
    <path d="M7 5h5.5a3.5 3.5 0 0 1 0 7H7zM7 12h6.5a3.5 3.5 0 0 1 0 7H7z" />
  </Svg>
);

export let IconItalic = () => (
  <Svg>
    <line x1="19" y1="4" x2="10" y2="4" />
    <line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </Svg>
);

export let IconUnderline = () => (
  <Svg>
    <path d="M7 4v7a5 5 0 0 0 10 0V4" />
    <line x1="5" y1="20" x2="19" y2="20" />
  </Svg>
);

export let IconStrike = () => (
  <Svg>
    <path d="M16 4H9a3 3 0 0 0-2.83 4" />
    <path d="M14 12a4 4 0 0 1 0 8H6" />
    <line x1="4" y1="12" x2="20" y2="12" />
  </Svg>
);

export let IconCode = () => (
  <Svg>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </Svg>
);

export let IconHighlight = () => (
  <Svg>
    <path d="M12 20h9" />
    <path d="m4 17 6-6 4 4-6 6H4z" />
    <path d="m14 7 3-3 4 4-3 3z" />
  </Svg>
);

export let IconLink = () => (
  <Svg>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
  </Svg>
);

export let IconH1 = () => (
  <Svg fontSize={11}>
    <path d="M4 6v12M12 6v12M4 12h8" />
    <path d="M17 9l3-1.5V18" />
  </Svg>
);

export let IconH2 = () => (
  <Svg>
    <path d="M4 6v12M12 6v12M4 12h8" />
    <path d="M16 10a2.5 2.5 0 0 1 5 0c0 1-.5 1.8-1.4 2.5L16 17h5" strokeWidth={1.6} />
  </Svg>
);

export let IconH3 = () => (
  <Svg>
    <path d="M4 6v12M12 6v12M4 12h8" />
    <path
      d="M16 8.5c.4-.9 1.4-1.5 2.5-1.5 1.4 0 2.5 1 2.5 2.4 0 1.2-.8 2-2 2.3 1.4.2 2.4 1.1 2.4 2.6C21.4 16 20.2 17 18.6 17c-1.3 0-2.3-.6-2.7-1.5"
      strokeWidth={1.6}
    />
  </Svg>
);

export let IconH4 = () => (
  <Svg>
    <path d="M4 6v12M12 6v12M4 12h8" />
    <path d="M21 7v10M16 7v5h5" strokeWidth={1.6} />
  </Svg>
);

export let IconH5 = () => (
  <Svg>
    <path d="M4 6v12M12 6v12M4 12h8" />
    <path d="M21 7h-5v4h2.5a2.5 2.5 0 1 1-2.5 3" strokeWidth={1.6} />
  </Svg>
);

export let IconH6 = () => (
  <Svg>
    <path d="M4 6v12M12 6v12M4 12h8" />
    <path
      d="M21 8a3 3 0 0 0-3-2c-1.5 0-2.5 1-2.5 3v6a2.5 2.5 0 0 0 5 0v-1a2.5 2.5 0 0 0-5 0"
      strokeWidth={1.5}
    />
  </Svg>
);

export let IconType = () => (
  <Svg>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </Svg>
);

export let IconMore = () => (
  <Svg>
    <rect x="3" y="3" width="6" height="6" rx="1.5" />
    <rect x="15" y="3" width="6" height="6" rx="1.5" />
    <rect x="3" y="15" width="6" height="6" rx="1.5" />
    <rect x="15" y="15" width="6" height="6" rx="1.5" />
  </Svg>
);

export let IconBulletList = () => (
  <Svg>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <circle cx="4" cy="6" r="1.2" fill="currentColor" />
    <circle cx="4" cy="12" r="1.2" fill="currentColor" />
    <circle cx="4" cy="18" r="1.2" fill="currentColor" />
  </Svg>
);

export let IconOrderedList = () => (
  <Svg>
    <line x1="10" y1="6" x2="21" y2="6" />
    <line x1="10" y1="12" x2="21" y2="12" />
    <line x1="10" y1="18" x2="21" y2="18" />
    <path d="M4 6h1v4" strokeWidth={1.6} />
    <path d="M4 10h2" strokeWidth={1.6} />
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" strokeWidth={1.6} />
  </Svg>
);

export let IconTaskList = () => (
  <Svg>
    <rect x="3" y="4" width="6" height="6" rx="1.5" />
    <polyline points="4 7 5 8.2 8 5.5" strokeWidth={1.5} />
    <line x1="12" y1="7" x2="21" y2="7" />
    <rect x="3" y="14" width="6" height="6" rx="1.5" />
    <line x1="12" y1="17" x2="21" y2="17" />
  </Svg>
);

export let IconQuote = () => (
  <Svg>
    <path d="M3 21c3-3 4-6 4-10V5h6v6h-4c0 4-1 7-3 10z" strokeWidth={1.5} />
    <path d="M13 21c3-3 4-6 4-10V5h6v6h-4c0 4-1 7-3 10z" strokeWidth={1.5} />
  </Svg>
);

export let IconCodeBlock = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <polyline points="8 10 6 12 8 14" />
    <polyline points="16 10 18 12 16 14" />
    <line x1="13" y1="9" x2="11" y2="15" />
  </Svg>
);

export let IconMermaid = () => (
  <Svg>
    <rect x="3" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="8.5" y="16" width="7" height="5" rx="1.5" />
    <path d="M6.5 8 L 6.5 12 L 12 12 L 12 16" strokeWidth={1.6} />
    <path d="M17.5 8 L 17.5 12 L 12 12" strokeWidth={1.6} />
  </Svg>
);

export let IconEquation = () => (
  <Svg>
    <path d="M5 7h7M5 17h7" />
    <path d="m14 6 5 6-5 6" />
    <path d="m19 6-5 6 5 6" />
  </Svg>
);

export let IconHr = () => (
  <Svg>
    <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 3" />
  </Svg>
);

export let IconTable = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="3" y1="16" x2="21" y2="16" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <line x1="15" y1="4" x2="15" y2="20" />
  </Svg>
);

export let IconImage = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <polyline points="3 17 9 12 13 16 17 12 21 16" />
  </Svg>
);

export let IconAlignLeft = () => (
  <Svg>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="15" y2="12" />
    <line x1="3" y1="18" x2="18" y2="18" />
  </Svg>
);

export let IconAlignCenter = () => (
  <Svg>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="6" y1="12" x2="18" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </Svg>
);

export let IconAlignRight = () => (
  <Svg>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="9" y1="12" x2="21" y2="12" />
    <line x1="6" y1="18" x2="21" y2="18" />
  </Svg>
);

export let IconUndo = () => (
  <Svg>
    <polyline points="9 14 4 9 9 4" />
    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
  </Svg>
);

export let IconRedo = () => (
  <Svg>
    <polyline points="15 14 20 9 15 4" />
    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
  </Svg>
);

export let IconCallout = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <line x1="7" y1="9" x2="17" y2="9" />
    <line x1="7" y1="13" x2="14" y2="13" />
    <line x1="7" y1="17" x2="11" y2="17" />
  </Svg>
);

export let IconChevronDown = () => (
  <Svg>
    <polyline points="6 9 12 15 18 9" />
  </Svg>
);

export let IconEye = () => (
  <Svg>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export let IconEdit = () => (
  <Svg>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Svg>
);

export let IconSplit = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </Svg>
);

export let IconSun = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4" />
    <line x1="12" y1="20" x2="12" y2="22" />
    <line x1="4" y1="12" x2="2" y2="12" />
    <line x1="22" y1="12" x2="20" y2="12" />
    <line x1="5" y1="5" x2="6.5" y2="6.5" />
    <line x1="17.5" y1="17.5" x2="19" y2="19" />
    <line x1="5" y1="19" x2="6.5" y2="17.5" />
    <line x1="17.5" y1="6.5" x2="19" y2="5" />
  </Svg>
);

export let IconMoon = () => (
  <Svg>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Svg>
);

export let IconCopy = () => (
  <Svg>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

export let IconDownload = () => (
  <Svg>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Svg>
);

export let IconUpload = () => (
  <Svg>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </Svg>
);

export let IconText = () => (
  <Svg>
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </Svg>
);

export let IconPlus = () => (
  <Svg>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export let IconTrash = () => (
  <Svg>
    <polyline points="4 7 20 7" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
  </Svg>
);

export let IconColumnInsertLeft = () => (
  <Svg>
    <rect x="11" y="4" width="9" height="16" rx="1.5" />
    <line x1="4" y1="12" x2="8" y2="12" />
    <line x1="6" y1="10" x2="6" y2="14" />
  </Svg>
);

export let IconColumnInsertRight = () => (
  <Svg>
    <rect x="4" y="4" width="9" height="16" rx="1.5" />
    <line x1="16" y1="12" x2="20" y2="12" />
    <line x1="18" y1="10" x2="18" y2="14" />
  </Svg>
);

export let IconColumnMoveLeft = () => (
  <Svg>
    <rect x="11" y="4" width="9" height="16" rx="1.5" />
    <polyline points="8 9 4 12 8 15" />
    <line x1="4" y1="12" x2="9" y2="12" />
  </Svg>
);

export let IconColumnMoveRight = () => (
  <Svg>
    <rect x="4" y="4" width="9" height="16" rx="1.5" />
    <polyline points="16 9 20 12 16 15" />
    <line x1="15" y1="12" x2="20" y2="12" />
  </Svg>
);

export let IconColumnDelete = () => (
  <Svg>
    <rect x="8" y="4" width="8" height="16" rx="1.5" />
    <line x1="9.5" y1="10" x2="14.5" y2="14" />
    <line x1="14.5" y1="10" x2="9.5" y2="14" />
  </Svg>
);

export let IconRowInsertAbove = () => (
  <Svg>
    <rect x="4" y="11" width="16" height="9" rx="1.5" />
    <line x1="12" y1="4" x2="12" y2="8" />
    <line x1="10" y1="6" x2="14" y2="6" />
  </Svg>
);

export let IconRowInsertBelow = () => (
  <Svg>
    <rect x="4" y="4" width="16" height="9" rx="1.5" />
    <line x1="12" y1="16" x2="12" y2="20" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </Svg>
);

export let IconRowMoveUp = () => (
  <Svg>
    <rect x="4" y="11" width="16" height="9" rx="1.5" />
    <polyline points="9 8 12 4 15 8" />
    <line x1="12" y1="4" x2="12" y2="9" />
  </Svg>
);

export let IconRowMoveDown = () => (
  <Svg>
    <rect x="4" y="4" width="16" height="9" rx="1.5" />
    <polyline points="9 16 12 20 15 16" />
    <line x1="12" y1="15" x2="12" y2="20" />
  </Svg>
);

export let IconRowDelete = () => (
  <Svg>
    <rect x="4" y="8" width="16" height="8" rx="1.5" />
    <line x1="10" y1="9.5" x2="14" y2="14.5" />
    <line x1="14" y1="9.5" x2="10" y2="14.5" />
  </Svg>
);

export let IconHeaderRow = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <rect x="3" y="4" width="18" height="6" rx="2" fill="currentColor" opacity="0.2" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);

export let IconHeaderColumn = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <rect x="3" y="4" width="6" height="16" rx="2" fill="currentColor" opacity="0.2" />
    <line x1="9" y1="4" x2="9" y2="20" />
  </Svg>
);

export let IconTableDelete = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <line x1="6.5" y1="14" x2="11.5" y2="19" stroke="currentColor" />
    <line x1="11.5" y1="14" x2="6.5" y2="19" stroke="currentColor" />
  </Svg>
);

export let IconInfo = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="11" x2="12" y2="16" />
    <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
  </Svg>
);

export let IconWarning = () => (
  <Svg>
    <path d="M12 4 L21 19 H3 Z" />
    <line x1="12" y1="10" x2="12" y2="14" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </Svg>
);

export let IconCheckCircle = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8 12.5 11 15.5 16.5 9.5" />
  </Svg>
);

export let IconDanger = () => (
  <Svg>
    <polygon points="8 3 16 3 21 8 21 16 16 21 8 21 3 16 3 8" />
    <line x1="12" y1="8" x2="12" y2="13" />
    <circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" />
  </Svg>
);

export let IconGrip = () => (
  <Svg>
    <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export let IconArrowLeft = () => (
  <Svg>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </Svg>
);

export let IconCloud = () => (
  <Svg>
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </Svg>
);

export let IconCloudCheck = () => (
  <Svg>
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    <polyline points="9 14 11 16 15 12" strokeWidth={1.6} />
  </Svg>
);

export let IconShare = () => (
  <Svg>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </Svg>
);

export let IconDots = () => (
  <Svg>
    <circle cx="6" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </Svg>
);

export let IconHistory = () => (
  <Svg>
    <path d="M3 12a9 9 0 1 0 3-6.71" />
    <polyline points="3 4 3 10 9 10" />
    <polyline points="12 7 12 12 15 14" strokeWidth={1.6} />
  </Svg>
);

export let IconCheck = () => (
  <Svg>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
);

export let IconArrowRight = () => (
  <Svg>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </Svg>
);

export let IconExternalLink = () => (
  <Svg>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
  </Svg>
);

export let IconUnlink = () => (
  <Svg>
    <path d="M9 17H7a5 5 0 0 1 0-10h2" />
    <path d="M15 7h2a5 5 0 0 1 4.546 7.082" />
    <line x1="8" y1="12" x2="12" y2="12" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </Svg>
);

export let IconClose = () => (
  <Svg>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </Svg>
);

export let IconKeyboard = () => (
  <Svg>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <line x1="6" y1="10" x2="6" y2="10" />
    <line x1="10" y1="10" x2="10" y2="10" />
    <line x1="14" y1="10" x2="14" y2="10" />
    <line x1="18" y1="10" x2="18" y2="10" />
    <line x1="6" y1="14" x2="6" y2="14" />
    <line x1="18" y1="14" x2="18" y2="14" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </Svg>
);
