import { ContractTransaction, providers } from 'ethers'
import { getTxTimestamp } from './getTxTimestamp'
import { MockProvider } from 'ethereum-waffle'

export const timeTravel = async (provider: providers.JsonRpcProvider, time: number) => {
  await provider.send('evm_increaseTime', [time])
  await provider.send('evm_mine', [])
}

export const timeTravelTo = async (provider: providers.JsonRpcProvider, timestamp: number) => {
  await provider.send('evm_mine', [timestamp])
}

export const setNextBlockTimestamp = async (provider: providers.JsonRpcProvider, timestamp: number) => {
  await provider.send('evm_setNextBlockTimestamp', [timestamp])
}

export const executeAndSetNextTimestamp = async (
  provider: MockProvider,
  contractFunction: Promise<ContractTransaction>,
  timestamp: number,
) => {
  const tx = await contractFunction
  const txTimestamp = await getTxTimestamp(tx, provider)
  await setNextBlockTimestamp(provider, txTimestamp + timestamp)
}
