import { deployMockContract } from 'ethereum-waffle'
import { IWithdrawController__factory } from 'contracts'
import { BigNumberish, ContractTransaction, Wallet } from 'ethers'

export interface MockWithdrawControllerConfig {
  onWithdraw?: { shares: BigNumberish; fee?: BigNumberish }
  withdrawLimit?: BigNumberish
  onRedeem?: { assets: BigNumberish; fee?: BigNumberish }
  redeemLimit?: BigNumberish
}

export async function mockWithdrawController(
  wallet: Wallet,
  setWithdrawController: (address: string) => Promise<ContractTransaction>,
  { onWithdraw, withdrawLimit, onRedeem, redeemLimit }: MockWithdrawControllerConfig,
) {
  const mockContract = await deployMockContract(wallet, IWithdrawController__factory.abi)

  if (onWithdraw) {
    await mockContract.mock.onWithdraw.returns(onWithdraw.shares, onWithdraw?.fee ?? 0)
    await mockContract.mock.previewWithdraw.returns(onWithdraw.shares)
  }

  if (onRedeem) {
    await mockContract.mock.onRedeem.returns(onRedeem.assets, onRedeem?.fee ?? 0)
    await mockContract.mock.previewRedeem.returns(onRedeem.assets)
  }

  if (withdrawLimit) {
    await mockContract.mock.maxWithdraw.returns(withdrawLimit)
  }

  if (redeemLimit) {
    await mockContract.mock.maxRedeem.returns(redeemLimit)
  }

  await setWithdrawController(mockContract.address)
  return mockContract
}
