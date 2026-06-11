export type MetorialEnterpriseChromeBridge = {
  showContactSupportModal?: (d?: { subject?: string; message?: string }) => void;
  showFeedbackModal?: () => void;
  showDocs?: () => void;
  showApi?: () => void;
  showChangelog?: () => void;
  showAssistant?: () => void;
};

export type MetorialEnterpriseWindow = {
  createOrganization?: (d: { name: string }) => Promise<{ id: string }>;
  landing_collection_ids?: string | string[];
  chrome?: MetorialEnterpriseChromeBridge;
  beforeCreateInstance?: () => void | Promise<unknown>;
  upgrade?: () => void | Promise<unknown>;
  demo_mode?: boolean;
};
