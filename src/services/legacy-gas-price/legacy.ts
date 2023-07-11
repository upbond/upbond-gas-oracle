import axios from 'axios'
import BigNumber from 'bignumber.js'

import {
  GasPrice,
  GasPriceKey,
  LegacyOracle,
  OnChainOracle,
  OffChainOracle,
  LegacyOptions,
  OnChainOracles,
  OffChainOracles,
  LegacyOptionsPayload,
  GetGasPriceFromRespInput,
} from './types'

import { ChainId, NETWORKS } from '@/config'
import { RpcFetcher, NodeJSCache } from '@/services'
import { GWEI, DEFAULT_TIMEOUT, GWEI_PRECISION, DEFAULT_BLOCK_DURATION } from '@/constants'

import { MULTIPLIERS, DEFAULT_GAS_PRICE } from './constants'

export class LegacyGasPriceOracle implements LegacyOracle {
  static getMedianGasPrice(gasPrices: GasPrice[]): GasPrice {
    console.log('getMedianGasPrice')
    const medianGasPrice: GasPrice = DEFAULT_GAS_PRICE

    const results: Record<GasPriceKey, number[]> = {
      instant: [],
      fast: [],
      standard: [],
      low: [],
    }

    for (const gasPrice of gasPrices) {
      results.instant.push(gasPrice.instant)
      results.fast.push(gasPrice.fast)
      results.standard.push(gasPrice.standard)
      results.low.push(gasPrice.low)
    }

    for (const type of Object.keys(medianGasPrice) as (keyof GasPrice)[]) {
      const allPrices = results[type].sort((a, b) => a - b)
      if (allPrices.length === 1) {
        medianGasPrice[type] = allPrices[0]
        continue
      } else if (allPrices.length === 0) {
        continue
      }
      const isEven = allPrices.length % 2 === 0
      const middle = Math.floor(allPrices.length / 2)
      medianGasPrice[type] = isEven ? (allPrices[middle - 1] + allPrices[middle]) / 2.0 : allPrices[middle]
    }

    return LegacyGasPriceOracle.normalize(medianGasPrice)
  }

  static getMultipliedPrices(gasPrice: number): GasPrice {
    console.log('getMultipliedPrices')
    return {
      instant: gasPrice * MULTIPLIERS.instant,
      fast: gasPrice * MULTIPLIERS.fast,
      standard: gasPrice * MULTIPLIERS.standard,
      low: gasPrice * MULTIPLIERS.low,
    }
  }

  static normalize(_gas: GasPrice): GasPrice {
    console.log('normalize')
    const format = {
      groupSeparator: '',
      decimalSeparator: '.',
    }

    console.log('Normalize_Gas:', JSON.stringify(_gas))

    const gas: GasPrice = { ..._gas }
    console.log('{Normalize_gas}', gas)
    for (const type of Object.keys(gas) as (keyof GasPrice)[]) {
      gas[type] = Number(new BigNumber(gas[type]).toFormat(GWEI_PRECISION, format))
    }

    return gas
  }

  static getCategorize(gasPrice: number): GasPrice {
    console.log('getCategorize')
    return LegacyGasPriceOracle.normalize(LegacyGasPriceOracle.getMultipliedPrices(gasPrice))
  }

  static getGasPriceFromResponse(payload: GetGasPriceFromRespInput): number {
    console.log('getGasPriceFromResponse')
    const { response, fetcherName, denominator = GWEI } = payload
    let fastGasPrice = new BigNumber(response)
    if (fastGasPrice.isZero()) {
      throw new Error(`${fetcherName} provides corrupted values`)
    }
    fastGasPrice = fastGasPrice.div(denominator)
    return fastGasPrice.toNumber()
  }

  public lastGasPrice: GasPrice
  public onChainOracles: OnChainOracles = {}
  public offChainOracles: OffChainOracles = {}
  public configuration: Required<LegacyOptions> = {
    shouldCache: false,
    chainId: ChainId.MAINNET,
    timeout: DEFAULT_TIMEOUT,
    blockTime: DEFAULT_BLOCK_DURATION,
    defaultRpc: NETWORKS[ChainId.MAINNET].rpcUrl,
    fallbackGasPrices: LegacyGasPriceOracle.getMultipliedPrices(NETWORKS[ChainId.MAINNET].defaultGasPrice),
  }

  private readonly fetcher: RpcFetcher

  private cache: NodeJSCache<GasPrice>
  private LEGACY_KEY = (chainId: ChainId) => `legacy-fee-${chainId}`

  constructor({ fetcher, ...options }: LegacyOptionsPayload) {
    this.fetcher = fetcher
    if (options) {
      this.configuration = { ...this.configuration, ...options }
    }

    const { defaultGasPrice } = NETWORKS[ChainId.MAINNET]
    const fallbackGasPrices = this.configuration.fallbackGasPrices || LegacyGasPriceOracle.getMultipliedPrices(defaultGasPrice)
    this.configuration.fallbackGasPrices = LegacyGasPriceOracle.normalize(fallbackGasPrices)

    const network = NETWORKS[this.configuration.chainId]?.oracles
    if (network) {
      this.offChainOracles = { ...network.offChainOracles }
      this.onChainOracles = { ...network.onChainOracles }
    }

    this.cache = new NodeJSCache({ stdTTL: this.configuration.blockTime, useClones: false })
  }

  public addOffChainOracle(oracle: OffChainOracle): void {
    this.offChainOracles[oracle.name] = oracle
  }

  public addOnChainOracle(oracle: OnChainOracle): void {
    this.onChainOracles[oracle.name] = oracle
  }

  public removeOnChainOracle(name: string): void {
    delete this.onChainOracles[name]
  }

  public removeOffChainOracle(name: string): void {
    delete this.offChainOracles[name]
  }

  public async fetchGasPricesOnChain(): Promise<number> {
    console.log('fetchGasPricesOnChain')
    for (const oracle of Object.values(this.onChainOracles)) {
      const { name, callData, contract, denominator, rpc } = oracle

      try {
        const response = await this.fetcher.makeRpcCall<{ result: string | number }>({
          rpc,
          method: 'eth_call',
          params: [{ data: callData, to: contract }, 'latest'],
        })

        if (response.status === 200) {
          return LegacyGasPriceOracle.getGasPriceFromResponse({
            denominator,
            fetcherName: `${name} oracle`,
            response: response.data.result,
          })
        }
        throw new Error(`Fetch gasPrice from ${name} oracle failed. Trying another one...`)
      } catch (e) {
        console.error(e.message)
      }
    }
    throw new Error('All oracles are down. Probably a network error.')
  }

  public async fetchGasPriceFromRpc(): Promise<number> {
    console.log('fetchGasPriceFromRpc')
    try {
      const { status, data } = await this.fetcher.makeRpcCall<{ result: string | number }>({
        params: [],
        method: 'eth_gasPrice',
      })

      if (status === 200) {
        return LegacyGasPriceOracle.getGasPriceFromResponse({
          fetcherName: 'Default RPC',
          response: data.result,
        })
      }

      throw new Error(`Fetch gasPrice from default RPC failed..`)
    } catch (e) {
      console.error(e.message)
      throw new Error('Default RPC is down. Probably a network error.')
    }
  }

  public async fetchGasPricesOffChain(shouldGetMedian = true): Promise<GasPrice> {
    console.log('fetchGasPricesOffChain')
    if (shouldGetMedian) {
      console.log('FetachGasPricesOffChain-ShouldGetMedian')
      return await this.fetchMedianGasPriceOffChain()
    }

    console.log('OracleObjec-InFetchGasPricesOffChain', this.offChainOracles)
    for (const oracle of Object.values(this.offChainOracles)) {
      try {
        return await this.askOracle(oracle)
      } catch (e) {
        console.info(`${oracle} has error - `, e.message)
        continue
      }
    }
    throw new Error('All oracles are down. Probably a network error.')
  }

  public async fetchMedianGasPriceOffChain(): Promise<GasPrice> {
    console.log('fetchMedianGasPriceOffChain')

    const promises: Promise<GasPrice>[] = []

    for (const oracle of Object.values(this.offChainOracles) as OffChainOracle[]) {
      promises.push(this.askOracle(oracle))
    }

    const settledPromises = await Promise.allSettled(promises)

    const allGasPrices = settledPromises.reduce((acc: GasPrice[], result) => {
      if (result.status === 'fulfilled') {
        acc.push(result.value)
        return acc
      }
      return acc
    }, [])

    if (allGasPrices.length === 0) {
      throw new Error('All oracles are down. Probably a network error.')
    }

    return LegacyGasPriceOracle.getMedianGasPrice(allGasPrices)
  }

  public async gasPrices(fallbackGasPrices?: GasPrice, shouldGetMedian = true): Promise<GasPrice> {
    console.log('GAS-PRICES')
    if (!this.lastGasPrice) {
      this.lastGasPrice = fallbackGasPrices || this.configuration.fallbackGasPrices
    }

    const cacheKey = this.LEGACY_KEY(this.configuration.chainId)
    console.log('CacheKey-GasPrices:', cacheKey)
    const cachedFees = await this.cache.get(cacheKey)
    console.log('CachedFees-GasPrices:', cachedFees)

    if (cachedFees) {
      console.log('IS CHACHED FEES')
      return cachedFees
    }
    if (Object.keys(this.offChainOracles).length > 0) {
      console.log('Object.keys(this.offChainOracles) is 0')
      console.log('ShouldGetMedian:', shouldGetMedian)
      try {
        this.lastGasPrice = await this.fetchGasPricesOffChain(shouldGetMedian)
        console.log('this.lastGasPrice:', JSON.stringify(this.lastGasPrice))
        if (this.configuration.shouldCache) {
          console.log('this.configuration.shouldCache')
          await this.cache.set(cacheKey, this.lastGasPrice)
        }
        return this.lastGasPrice
      } catch (e) {
        console.error('Failed to fetch gas prices from offchain oracles...')
      }
    }

    if (Object.keys(this.onChainOracles).length > 0) {
      try {
        const fastGas = await this.fetchGasPricesOnChain()

        this.lastGasPrice = LegacyGasPriceOracle.getCategorize(fastGas)
        if (this.configuration.shouldCache) {
          await this.cache.set(cacheKey, this.lastGasPrice)
        }
        return this.lastGasPrice
      } catch (e) {
        console.error('Failed to fetch gas prices from onchain oracles...')
      }
    }

    try {
      const fastGas = await this.fetchGasPriceFromRpc()

      this.lastGasPrice = LegacyGasPriceOracle.getCategorize(fastGas)
      if (this.configuration.shouldCache) {
        await this.cache.set(cacheKey, this.lastGasPrice)
      }
      return this.lastGasPrice
    } catch (e) {
      console.error('Failed to fetch gas prices from default RPC. Last known gas will be returned')
    }
    return LegacyGasPriceOracle.normalize(this.lastGasPrice)
  }

  public async askOracle(oracle: OffChainOracle): Promise<GasPrice> {
    console.log('askOracle')
    const {
      url,
      name,
      denominator,
      lowPropertyName,
      fastPropertyName,
      instantPropertyName,
      standardPropertyName,
      additionalDataProperty,
    } = oracle

    const response = await axios.get(url, { timeout: this.configuration.timeout })
    console.log('Response-Ask-Oracle:', response)

    if (response.status === 200) {
      const gas = additionalDataProperty ? response.data[additionalDataProperty] : response.data
      console.log('Gas-AskOracle:', JSON.stringify(gas))
      console.log('InstantPropertyName:', JSON.stringify(instantPropertyName))
      console.log('FastPropertyName:', JSON.stringify(fastPropertyName))
      console.log('StandardPropertyName:', JSON.stringify(standardPropertyName))
      console.log('LowPropertyName:', JSON.stringify(lowPropertyName))
      console.log('Denominator:', JSON.stringify(denominator))
      if (Number(gas[fastPropertyName]) === 0) {
        throw new Error(`${name} oracle provides corrupted values`)
      }

      const gasPrices: GasPrice = {
        instant: parseFloat(gas[instantPropertyName]) / denominator,
        fast: parseFloat(gas[fastPropertyName]) / denominator,
        standard: parseFloat(gas[standardPropertyName]) / denominator,
        low: parseFloat(gas[lowPropertyName]) / denominator,
      }
      console.log('GasPrices-askOracle:', gasPrices)
      return LegacyGasPriceOracle.normalize(gasPrices)
    } else {
      throw new Error(`Fetch gasPrice from ${name} oracle failed. Trying another one...`)
    }
  }
}
