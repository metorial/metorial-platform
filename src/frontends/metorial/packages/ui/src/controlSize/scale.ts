export let controlSizes = {
  '1': {
    gap: '6px',
    height: '26px',
    padding: '0 8px',
    borderRadius: '6px',
    fontSize: '12px'
  },

  '2': {
    gap: '8px',
    height: '30px',
    padding: '0 10px',
    borderRadius: '8px',
    fontSize: '14px'
  },

  '3': {
    gap: '10px',
    height: '36px',
    padding: '0 12px',
    borderRadius: '10px',
    fontSize: '16px'
  },

  '4': {
    gap: '12px',
    height: '42px',
    padding: '0 14px',
    borderRadius: '12px',
    fontSize: '18px'
  },

  '5': {
    gap: '14px',
    height: '48px',
    padding: '0 16px',
    borderRadius: '14px',
    fontSize: '20px'
  }
};

export type ControlSize = keyof typeof controlSizes;

export let controlMetrics = {
  '1': { inset: 2, iconSize: 14, fieldFontSize: '12px' },
  '2': { inset: 2, iconSize: 14, fieldFontSize: '14px' },
  '3': { inset: 3, iconSize: 16, fieldFontSize: '14px' },
  '4': { inset: 3, iconSize: 16, fieldFontSize: '16px' },
  '5': { inset: 4, iconSize: 18, fieldFontSize: '18px' }
};

export let getControlSize = (size: ControlSize) => controlSizes[size];

export let getFieldFontSize = (size: ControlSize) => controlMetrics[size].fieldFontSize;

export let getNestedControlSize = (size: ControlSize) => {
  let outer = controlSizes[size];
  let { inset, iconSize } = controlMetrics[size];

  return {
    ...outer,
    inset,
    iconSize,
    itemHeight: `calc(${outer.height} - ${inset * 2}px)`,
    itemBorderRadius: `calc(${outer.borderRadius} - ${inset}px)`
  };
};

export let surface = {
  borderRadius: '10px',
  padding: 5,
  itemHeight: '30px',
  itemBorderRadius: '5px'
};
