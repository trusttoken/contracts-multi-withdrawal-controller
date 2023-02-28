import { expect } from 'chai'
import {
  PortfolioStatus,
  structuredPortfolioFixture,
  structuredPortfolioLiveFixture,
} from 'fixtures/structuredPortfolioFixture'
import { parseUSDC } from 'utils'
import { setupFixtureLoader } from 'test/setup'

describe('MultiWithdrawalController.maxRedeem', () => {
  const fixtureLoader = setupFixtureLoader()

  describe('when redemptions are allowed, with a floor', () => {
    it('returns shares proportional to amount over floor', async () => {
      const { equityTranche, equityTrancheData, wallet, depositToTranche } = await fixtureLoader(
        structuredPortfolioFixture,
      )
      await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.CapitalFormation)

      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(30))

      expect(await equityTranche.maxRedeem(wallet.address)).to.eq(parseUSDC(70))
    })
  })

  describe('when redemptions are disabled', () => {
    it('returns zero', async () => {
      const { equityTranche, wallet, depositToTranche } = await fixtureLoader(structuredPortfolioFixture)

      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      expect(await equityTranche.maxRedeem(wallet.address)).to.eq(0)
    })
  })

  describe('when portfolio is closed', () => {
    it('returns full amount of shares', async () => {
      const { equityTranche, equityTrancheData, depositToTranche, wallet, startAndClosePortfolio } =
        await fixtureLoader(structuredPortfolioFixture)
      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(30))

      await startAndClosePortfolio()
      expect(await equityTranche.maxRedeem(wallet.address)).to.eq(parseUSDC(100))
    })
  })

  it('is limited by virtual token balance if it is below totalAssets', async () => {
    const { structuredPortfolio, addAndFundLoan, getLoan, equityTranche, equityTrancheData, wallet } =
      await fixtureLoader(structuredPortfolioLiveFixture)
    await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.Live)

    const maxLoanValue = (await structuredPortfolio.totalAssets()).sub(parseUSDC(1))
    await addAndFundLoan(getLoan({ principal: maxLoanValue }))
    await structuredPortfolio.updateCheckpoints()
    expect(await equityTranche.maxRedeem(wallet.address)).to.equal(await structuredPortfolio.virtualTokenBalance())
  })
})
