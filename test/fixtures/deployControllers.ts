import {
  DepositController__factory,
  MultiWithdrawalController__factory,
  TransferEnabledController__factory,
} from 'build/types'
import { Wallet } from 'ethers'

export async function deployControllers(wallet: Wallet) {
  const depositController = await new DepositController__factory(wallet).deploy()
  const withdrawController = await new MultiWithdrawalController__factory(wallet).deploy()
  const transferController = await new TransferEnabledController__factory(wallet).deploy()

  return { depositController, withdrawController, transferController }
}
