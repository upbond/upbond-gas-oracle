import { OffChainOracle, OffChainOracles, OnChainOracle, OnChainOracles } from '@/services'

const ethgasstation: OffChainOracle = {
  name: 'ethgasstation',
  url: 'https://beaconcha.in/api/v1/execution/gasnow',
  instantPropertyName: 'rapid',
  fastPropertyName: 'fast',
  standardPropertyName: 'standard',
  lowPropertyName: 'slow',
  denominator: 1e9,
  additionalDataProperty: 'data',
}

const etherchain: OffChainOracle = {
  name: 'etherchain',
  url: 'https://beaconcha.in/api/v1/execution/gasnow',
  instantPropertyName: 'rapid',
  fastPropertyName: 'fast',
  standardPropertyName: 'standard',
  lowPropertyName: 'slow',
  denominator: 1e9,
  additionalDataProperty: 'data',
}

const chainlink: OnChainOracle = {
  name: 'chainlink',
  callData: '0x50d25bcd',
  contract: '0x169E633A2D1E6c10dD91238Ba11c4A708dfEF37C',
  denominator: '1000000000',
}

export const offChainOracles: OffChainOracles = {
  ethgasstation,
  etherchain,
}

export const onChainOracles: OnChainOracles = {
  chainlink,
}

export default {
  offChainOracles,
  onChainOracles,
}
