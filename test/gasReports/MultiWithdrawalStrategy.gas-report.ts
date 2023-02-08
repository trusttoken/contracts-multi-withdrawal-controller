import { WithdrawalExceptionStruct } from 'contracts/MultiWithdrawalController'
import { structuredPortfolioLiveFixture, WithdrawType } from 'fixtures/structuredPortfolioFixture'
import { setupFixtureLoader } from 'test/setup'
import { parseBPS } from 'utils/parseBPS'
import { parseUSDC } from 'utils/parseUSDC'

describe('MultiWithdrawalStrategy', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(structuredPortfolioLiveFixture)

  it('Calls multiRedeem for one address, then for ten', async () => {
    const { equityTranche, equityTrancheData, other, another, depositAndApproveToTranche } = await loadFixture()
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), another)

    const exception: WithdrawalExceptionStruct = {
      lender: other.address,
      assetAmount: parseUSDC(1),
      fee: parseBPS(2),
      shareAmount: parseUSDC(1),
      withdrawType: WithdrawType.Interest,
    }

    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, [exception])

    const otherException: WithdrawalExceptionStruct = {
      lender: another.address,
      assetAmount: parseUSDC(1),
      fee: parseBPS(1),
      shareAmount: parseUSDC(2),
      withdrawType: WithdrawType.Interest,
    }

    const exceptions: WithdrawalExceptionStruct[] = Array.from({ length: 10 }).map((_, index) =>
      index % 2 ? exception : otherException,
    )

    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)
  })
})
