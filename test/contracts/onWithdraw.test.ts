import { parseUSDC } from 'utils'
import { structuredPortfolioFixture, structuredPortfolioLiveFixture } from 'fixtures/structuredPortfolioFixture'
import { setupFixtureLoader } from 'test/setup'
import { expect } from 'chai'

describe('MultiWithdrawalController.onWithdraw', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(structuredPortfolioLiveFixture)

  describe('when withdrawing based on exception', () => {
    it('reverts if called by lender', async () => {
      const { withdrawFromTranche, equityTranche, wallet } = await loadFixture()
      await expect(withdrawFromTranche(equityTranche, parseUSDC(50), wallet.address)).to.be.revertedWith(
        'MWC: Withdrawals are not allowed',
      )
    })
  })

  describe('when portfolio is closed', () => {
    it('can withdraw below floor', async () => {
      const {
        equityTranche,
        equityTrancheData,
        depositToTranche,
        withdrawFromTranche,
        startAndClosePortfolio,
        token,
        wallet,
      } = await fixtureLoader(structuredPortfolioFixture)

      const amount = parseUSDC(1000)
      await depositToTranche(equityTranche, amount)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(500))

      await startAndClosePortfolio()
      await expect(withdrawFromTranche(equityTranche, amount)).to.changeTokenBalances(
        token,
        [equityTranche, wallet],
        [-amount, amount],
      )
    })
  })
})
