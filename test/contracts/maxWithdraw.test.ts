import { expect } from 'chai'
import { PortfolioStatus, structuredPortfolioFixture } from 'fixtures/structuredPortfolioFixture'
import { parseUSDC } from 'utils'
import { setupFixtureLoader } from 'test/setup'

describe('MultiWithdrawalController.maxWithdraw', () => {
  const fixtureLoader = setupFixtureLoader()

  describe('when withdrawals are allowed, with a floor', () => {
    it('returns available amount over floor', async () => {
      const { equityTranche, equityTrancheData, wallet, depositToTranche } = await fixtureLoader(
        structuredPortfolioFixture,
      )
      await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.CapitalFormation)

      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(30))

      expect(await equityTranche.maxWithdraw(wallet.address)).to.eq(parseUSDC(70))
    })
  })

  describe('when withdrawals are disabled', () => {
    it('returns zero', async () => {
      const { equityTranche, wallet, depositToTranche } = await fixtureLoader(structuredPortfolioFixture)

      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      expect(await equityTranche.maxWithdraw(wallet.address)).to.eq(0)
    })
  })

  describe('when portfolio is closed', () => {
    it('returns full amount based on shares', async () => {
      const { equityTranche, equityTrancheData, depositToTranche, wallet, startAndClosePortfolio } =
        await fixtureLoader(structuredPortfolioFixture)
      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(30))

      await startAndClosePortfolio()
      expect(await equityTranche.maxWithdraw(wallet.address)).to.eq(parseUSDC(100))
    })
  })
})
