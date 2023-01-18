import { expect } from 'chai'
import { PortfolioStatus, structuredPortfolioFixture } from 'fixtures/structuredPortfolioFixture'
import { parseUSDC } from 'utils'
import { setupFixtureLoader } from 'test/setup'

describe('MultiWithdrawalController.maxRedeem', () => {
  const fixtureLoader = setupFixtureLoader()

  describe('when redemption is allowed, with a floor', () => {
    it('returns shares proportional to amount over floor', async () => {
      const { equityTranche, equityTrancheData, wallet, depositToTranche } = await fixtureLoader(
        structuredPortfolioFixture,
      )
      await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.Live)

      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(30))

      expect(await equityTranche.maxRedeem(wallet.address)).to.eq(parseUSDC(70))
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
})
