import { expect } from 'chai'
import { structuredPortfolioFixture, structuredPortfolioLiveFixture } from 'fixtures/structuredPortfolioFixture'
import { parseUSDC } from 'utils'
import { setupFixtureLoader } from 'test/setup'
import { Fixture, LiveFixture, PortfolioStatus } from 'fixtures/types'
import { structuredAssetVaultFixture, structuredAssetVaultLiveFixture } from 'fixtures/structuredAssetVaultFixture'

function testMaxWithdraw(loadFixture: () => Promise<Fixture>, loadLiveFixture: () => Promise<LiveFixture>) {
  describe('when withdrawals are allowed, with a floor', () => {
    it('returns available amount over floor', async () => {
      const { equityTranche, equityTrancheData, wallet, depositToTranche } = await loadFixture()
      await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.CapitalFormation)

      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(30))

      expect(await equityTranche.maxWithdraw(wallet.address)).to.eq(parseUSDC(70))
    })
  })

  describe('when withdrawals are disabled', () => {
    it('returns zero', async () => {
      const { equityTranche, wallet, depositToTranche } = await loadFixture()

      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      expect(await equityTranche.maxWithdraw(wallet.address)).to.eq(0)
    })
  })

  describe('when portfolio is closed', () => {
    it('returns full amount based on shares', async () => {
      const { equityTranche, equityTrancheData, depositToTranche, wallet, startAndClosePortfolio } = await loadFixture()
      await depositToTranche(equityTranche, parseUSDC(100), wallet)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(30))

      await startAndClosePortfolio()
      expect(await equityTranche.maxWithdraw(wallet.address)).to.eq(parseUSDC(100))
    })
  })

  it('is limited by virtual token balance if it is below totalAssets', async () => {
    const {
      getPortfolioTotalAssets,
      getPortfolioVirtualTokenBalance,
      updateCheckpoints,
      addAndFundLoan,
      getLoan,
      equityTranche,
      equityTrancheData,
      wallet,
    } = await loadLiveFixture()
    await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.Live)

    const maxLoanValue = (await getPortfolioTotalAssets()).sub(parseUSDC(1))
    await addAndFundLoan(getLoan({ principal: maxLoanValue }))
    await updateCheckpoints()
    expect(await equityTranche.maxWithdraw(wallet.address)).to.equal(await getPortfolioVirtualTokenBalance())
  })
}

describe('MultiWithdrawalController.maxWithdraw', () => {
  const fixtureLoader = setupFixtureLoader()

  describe('StructuredPortfolio', () => {
    testMaxWithdraw(
      () => fixtureLoader(structuredPortfolioFixture),
      () => fixtureLoader(structuredPortfolioLiveFixture),
    )
  })

  describe('StructuredAssetVault', () => {
    testMaxWithdraw(
      () => fixtureLoader(structuredAssetVaultFixture),
      () => fixtureLoader(structuredAssetVaultLiveFixture),
    )
  })
})
