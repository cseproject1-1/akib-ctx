export const HANDLE_IDS = {
  SOURCE: {
    TOP: 's-top',
    BOTTOM: 's-bottom',
    LEFT: 's-left',
    RIGHT: 's-right',
  },
  TARGET: {
    TOP: 't-top',
    BOTTOM: 't-bottom',
    LEFT: 't-left',
    RIGHT: 't-right',
  }
} as const;

export type HandleType = typeof HANDLE_IDS.SOURCE[keyof typeof HANDLE_IDS.SOURCE] | typeof HANDLE_IDS.TARGET[keyof typeof HANDLE_IDS.TARGET];
