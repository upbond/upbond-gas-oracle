import { OffChainOracle, OffChainOracles, OnChainOracles } from '@/services'

const maticGasStation: OffChainOracle = {
  name: 'maticGasStation',
  url: 'https://gasstation.polygon.technology/v2',
  instantPropertyName: 'fastest',
  fastPropertyName: 'fast',
  standardPropertyName: 'standard',
  lowPropertyName: 'safeLow',
  denominator: 1,
  additionalDataProperty: null,
}

export const offChainOracles: OffChainOracles = {
  maticGasStation,
}

export const onChainOracles: OnChainOracles = {}

export default {
  offChainOracles,
  onChainOracles,
}
