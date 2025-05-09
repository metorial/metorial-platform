export interface MetorialMapper<T> {
  transformTo: (input: any) => any;
  transformFrom: (input: any) => T;
}
