import { MultiWithdrawalController } from '../build/artifacts'
import { contract, deploy } from 'ethereum-mars'

export function deployContract() {
  const multiWithdrawalController = contract(MultiWithdrawalController)
  return { multiWithdrawalController }
}

deploy({ verify: true }, deployContract)
