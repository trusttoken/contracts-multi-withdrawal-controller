import { parseUSDC } from 'utils'
import { structuredPortfolioFixture, structuredPortfolioLiveFixture } from 'fixtures/structuredPortfolioFixture'
import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { Fixture, LiveFixture } from 'fixtures/types'
import { structuredAssetVaultFixture, structuredAssetVaultLiveFixture } from 'fixtures/structuredAssetVaultFixture'

function testOnRedeem(loadFixture: () => Promise<Fixture>, loadLiveFixture: () => Promise<LiveFixture>) {
  describe('when redeeming based on exception', () => {
    it('reverts if called by lender', async () => {
      const { redeemFromTranche, equityTranche } = await loadLiveFixture()
      await expect(redeemFromTranche(equityTranche, parseUSDC(0))).to.be.revertedWith(
        'MWC: Only controller can withdraw based on exception',
      )
    })
  })

  describe('when portfolio is closed', () => {
    it('can redeem below floor', async () => {
      const {
        equityTranche,
        equityTrancheData,
        depositToTranche,
        redeemFromTranche,
        startAndClosePortfolio,
        token,
        wallet,
      } = await loadFixture()

      const amount = parseUSDC(1000)
      await depositToTranche(equityTranche, amount)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(500))

      await startAndClosePortfolio()
      await expect(redeemFromTranche(equityTranche, amount)).to.changeTokenBalances(
        token,
        [equityTranche, wallet],
        [-amount, amount],
      )
    })
  })
}

describe('MultiWithdrawalController.onRedeem', () => {
  const fixtureLoader = setupFixtureLoader()

  describe('StructuredPortfolio', () => {
    testOnRedeem(
      () => fixtureLoader(structuredPortfolioFixture),
      () => fixtureLoader(structuredPortfolioLiveFixture),
    )
  })

  describe('StructuredAssetVault', () => {
    testOnRedeem(
      () => fixtureLoader(structuredAssetVaultFixture),
      () => fixtureLoader(structuredAssetVaultLiveFixture),
    )
  })
})
