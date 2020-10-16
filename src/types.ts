export type OffChainOracle = {
  name: string;
  url: string;
  instantPropertyName: string;
  fastPropertyName: string;
  standardPropertyName: string;
  lowPropertyName: string;
  denominator: number;
};

export type OnChainOracle = {
  name: string;
  rpc?: string;
  contract: string;
  callData: string;
  denominator: string;
};

export type GasPrice = {
  [key in GasPriceKey]: number;
};

export type GasPriceKey = 'instant' | 'fast' | 'standard' | 'low';

export interface ConstructorArgs {
  defaultRpc?: string;
}
