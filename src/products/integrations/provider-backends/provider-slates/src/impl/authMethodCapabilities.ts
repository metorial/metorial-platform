type SlateAuthMethodCapabilities = {
  adminSetup?: { enabled?: boolean; required?: boolean };
};

// `required` is only kept when set so specifications of slates without it stay unchanged.
export let toAuthMethodCapabilities = (capabilities: unknown) => {
  let adminSetup = (capabilities as SlateAuthMethodCapabilities | undefined)?.adminSetup;
  if (!adminSetup?.enabled) return {};

  return {
    adminSetup: { enabled: true, ...(adminSetup.required === true ? { required: true } : {}) }
  };
};
