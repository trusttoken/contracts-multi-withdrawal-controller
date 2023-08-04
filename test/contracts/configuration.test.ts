import { expect } from 'chai'
import { Fixture, PortfolioStatus } from 'fixtures/types'
import { structuredAssetVaultFixture } from 'fixtures/structuredAssetVaultFixture'
import { structuredPortfolioFixture } from 'fixtures/structuredPortfolioFixture'
import { setupFixtureLoader } from 'test/setup'
import { parseUSDC } from 'utils/parseUSDC'

function testConfiguration(loadFixture: () => Promise<Fixture>) {
  describe('setFloor', () => {
    it('sets the new floor', async () => {
      const {
        equityTrancheData: { withdrawController },
      } = await loadFixture()

      await withdrawController.setFloor(parseUSDC(13))
      expect(await withdrawController.floor()).to.eq(parseUSDC(13))
    })

    it('fails if a non-manager attempts to call it', async () => {
      const {
        equityTrancheData: { withdrawController },
        other,
      } = await loadFixture()

      await expect(withdrawController.connect(other).setFloor(parseUSDC(13))).to.be.revertedWith('MWC: Only manager')
    })
  })

  describe('setWithdrawAllowed', () => {
    it('changes the value', async () => {
      const {
        equityTrancheData: { withdrawController },
      } = await loadFixture()

      expect(await withdrawController.withdrawAllowed(PortfolioStatus.Live)).to.be.false
      await withdrawController.setWithdrawAllowed(true, PortfolioStatus.Live)
      expect(await withdrawController.withdrawAllowed(PortfolioStatus.Live)).to.be.true
    })

    it('fails if a non-manager attempts to call it', async () => {
      const {
        equityTrancheData: { withdrawController },
        other,
      } = await loadFixture()

      await expect(withdrawController.connect(other).setWithdrawAllowed(true, PortfolioStatus.Live)).to.be.revertedWith(
        'MWC: Only manager',
      )
    })
  })

  describe('configure', () => {
    it('changes the values', async () => {
      const {
        equityTrancheData: { withdrawController },
      } = await loadFixture()

      expect(await withdrawController.withdrawAllowed(PortfolioStatus.Live)).to.be.false
      await withdrawController.configure(parseUSDC(13), { status: PortfolioStatus.Live, value: true })

      expect(await withdrawController.withdrawAllowed(PortfolioStatus.Live)).to.be.true
      expect(await withdrawController.floor()).to.eq(parseUSDC(13))
    })

    it('does not verify manager if new values are identical to old ones', async () => {
      const {
        equityTrancheData: { withdrawController },
        other,
      } = await loadFixture()

      expect(await withdrawController.withdrawAllowed(PortfolioStatus.Live)).to.be.false
      const currentFloor = await withdrawController.floor()
      await expect(
        withdrawController.connect(other).configure(currentFloor, { status: PortfolioStatus.Live, value: false }),
      ).not.to.be.reverted
    })
  })
}

describe('MultiWithdrawalController configuration', () => {
  const fixtureLoader = setupFixtureLoader()

  describe('StructuredPortfolio', () => {
    const loadFixture = () => fixtureLoader(structuredPortfolioFixture)

    testConfiguration(loadFixture)
  })

  describe('StructuredAssetVault', () => {
    const loadFixture = () => fixtureLoader(structuredAssetVaultFixture)

    testConfiguration(loadFixture)
  })
})
