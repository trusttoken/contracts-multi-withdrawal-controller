import { DepositController__factory, MultiWithdrawalController__factory } from 'build/types'
import { TransferController__factory } from 'build/types/factories/TransferController__factory'
import { Wallet } from 'ethers'

export async function deployControllers(wallet: Wallet) {
  const depositController = await new DepositController__factory(wallet).deploy()
  const withdrawController = await new MultiWithdrawalController__factory(wallet).deploy()
  const transferController = await new TransferController__factory(wallet).deploy()

  return { depositController, withdrawController, transferController }
}
