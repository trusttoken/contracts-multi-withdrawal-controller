import { IDepositController__factory } from 'build/types'
import { deployMockContract } from 'ethereum-waffle'
import { BigNumber, BigNumberish, ContractTransaction, Wallet } from 'ethers'

export interface MockDepositControllerConfig {
  onDeposit?: { shares: BigNumberish; fee?: BigNumberish }
  depositLimit?: BigNumberish
  onMint?: { assets: BigNumberish; fee?: BigNumberish }
  mintLimit?: BigNumberish
}

export async function mockDepositController(
  wallet: Wallet,
  setDepositController: (address: string) => Promise<ContractTransaction>,
  { onDeposit, depositLimit, onMint, mintLimit }: MockDepositControllerConfig,
) {
  const mockContract = await deployMockContract(wallet, IDepositController__factory.abi)

  if (onDeposit) {
    await mockContract.mock.onDeposit.returns(onDeposit.shares, onDeposit?.fee ?? 0)
    await mockContract.mock.previewDeposit.returns(onDeposit.shares ?? 0)
  }
  if (depositLimit) {
    await mockContract.mock.maxDeposit.returns(depositLimit)
  }

  if (onMint) {
    await mockContract.mock.onMint.returns(onMint.assets, onMint?.fee ?? 0)
    await mockContract.mock.previewMint.returns(BigNumber.from(onMint.assets).add(onMint?.fee ?? 0))
  }

  if (mintLimit) {
    await mockContract.mock.maxMint.returns(mintLimit)
  }

  await setDepositController(mockContract.address)
  return mockContract
}
