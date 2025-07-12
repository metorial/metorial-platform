export type Participant =
  | {
      type: 'server';
      id: string;
    }
  | {
      type: 'client';
      id: string;
    };
