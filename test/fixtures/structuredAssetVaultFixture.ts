import { DepositController, TrancheVaultTest } from 'build/types'
import { BigNumber, BigNumberish, constants, Wallet } from 'ethers'
import { setupAssetVaultLoansHelper } from './setupLoansManagerHelpers'
import { YEAR } from 'utils/constants'
import { timeTravel } from 'utils/timeTravel'
import { getTxTimestamp } from 'utils/getTxTimestamp'
import { sum } from 'utils/sum'
import { MockProvider } from 'ethereum-waffle'
import { parseBPS } from 'utils'
import { getStructuredAssetVaultFactoryFixture } from './structuredAssetVaultFactoryFixture'
import { FixtureTrancheData, PortfolioStatus, FixtureConfig } from './types'

const getStructuredAssetVaultFixture = ({
  tokenDecimals = 6,
  initialTokens = [1e12, 1e10],
}: {
  tokenDecimals?: number
  initialTokens?: number[]
}) => {
  return async ([wallet, other, ...rest]: Wallet[], provider: MockProvider) => {
    const factoryFixtureResult = await getStructuredAssetVaultFactoryFixture({ tokenDecimals, initialTokens })([
      wallet,
      other,
      ...rest,
    ])
    const { portfolioDuration, getPortfolioFromTx, tranches, tranchesData, token } = factoryFixtureResult

    const assetVault = await getPortfolioFromTx()

    const repayerRole = await assetVault.REPAYER_ROLE()
    for (const account of [wallet, other, ...rest]) {
      const { address } = account
      await assetVault.grantRole(repayerRole, address)
    }

    function withdrawFromTranche(
      tranche: TrancheVaultTest,
      amount: BigNumberish,
      owner = wallet.address,
      receiver = wallet.address,
    ) {
      return tranche.withdraw(amount, receiver, owner)
    }

    function redeemFromTranche(
      tranche: TrancheVaultTest,
      amount: BigNumberish,
      owner = wallet.address,
      receiver = wallet.address,
    ) {
      return tranche.redeem(amount, receiver, owner)
    }

    async function setDepositAllowed(controller: DepositController, value: boolean, portfolio = assetVault) {
      await controller.setDepositAllowed(value, await portfolio.status())
    }

    async function startPortfolioAndEnableLiveActions() {
      const tx = await assetVault.start()
      for (const trancheData of tranchesData) {
        await setDepositAllowed(trancheData.depositController, true)
      }
      return tx
    }

    async function startAndClosePortfolio() {
      await assetVault.start()
      await timeTravel(provider, portfolioDuration)
      await assetVault.close()
    }

    async function mintToPortfolio(amount: BigNumberish, portfolio = assetVault) {
      await token.mint(portfolio.address, amount)
      await portfolio.mockIncreaseVirtualTokenBalance(amount)
    }

    async function burnFromPortfolio(amount: BigNumberish, portfolio = assetVault) {
      await token.burn(portfolio.address, amount)
      await portfolio.mockDecreaseVirtualTokenBalance(amount)
    }

    async function increaseAssetsInTranche(tranche: TrancheVaultTest, amount: BigNumberish) {
      await token.mint(tranche.address, amount)
      await tranche.mockIncreaseVirtualTokenBalance(amount)
    }

    async function decreaseAssetsInTranche(tranche: TrancheVaultTest, amount: BigNumberish) {
      await token.burn(tranche.address, amount)
      await tranche.mockDecreaseVirtualTokenBalance(amount)
    }

    function withInterest(initialAmount: BigNumberish, apy: number, period: number) {
      const initialAmountBN = BigNumber.from(initialAmount)
      const yearlyInterest = initialAmountBN.mul(apy).div(parseBPS(100))
      const periodInterest = yearlyInterest.mul(period).div(YEAR)
      return initialAmountBN.add(periodInterest)
    }

    function updateCheckpoints() {
      return assetVault.updateCheckpoints()
    }

    function getPortfolioTotalAssets() {
      return assetVault.totalAssets()
    }

    function getPortfolioVirtualTokenBalance() {
      return assetVault.virtualTokenBalance()
    }

    function getPortfolioEndDate() {
      return assetVault.endDate()
    }

    const [equityTranche, juniorTranche, seniorTranche] = tranches

    const loansManagerHelpers = await setupAssetVaultLoansHelper(assetVault, other, token)

    return {
      assetVault,
      ...loansManagerHelpers,
      PortfolioStatus,
      withdrawFromTranche,
      redeemFromTranche,
      startAndClosePortfolio,
      startPortfolioAndEnableLiveActions,
      ...factoryFixtureResult,
      equityTranche,
      juniorTranche,
      seniorTranche,
      withInterest,
      setDepositAllowed,
      mintToPortfolio,
      burnFromPortfolio,
      increaseAssetsInTranche,
      decreaseAssetsInTranche,
      otherWallets: rest,
      updateCheckpoints,
      getPortfolioTotalAssets,
      getPortfolioVirtualTokenBalance,
      getPortfolioEndDate,
    }
  }
}

export const structuredAssetVaultFixture = getStructuredAssetVaultFixture({ tokenDecimals: 6 })

export const getStructuredAssetVaultLiveFixture = (
  config: FixtureConfig = {
    tokenDecimals: 6,
    initialDeposits: [2e6, 3e6, 5e6],
    initialTokens: [2e6, 3e6],
  },
) => {
  return async ([wallet, borrower, ...rest]: Wallet[], provider: MockProvider) => {
    const portfolioFixtureResult = await getStructuredAssetVaultFixture(config)([wallet, borrower, ...rest], provider)
    const {
      tranches,
      depositToTranche,
      parseTokenUnits,
      tranchesData,
      withInterest,
      startPortfolioAndEnableLiveActions,
    } = portfolioFixtureResult

    const initialDeposits = config.initialDeposits.map(parseTokenUnits)
    const totalDeposit = sum(...initialDeposits)
    if (initialDeposits.length > 0) {
      for (let i = 0; i < tranches.length; i++) {
        await depositToTranche(tranches[i], initialDeposits[i])
      }
    }

    const portfolioStartTx = await startPortfolioAndEnableLiveActions()
    const portfolioStartTimestamp = await getTxTimestamp(portfolioStartTx, provider)

    function calculateTargetTrancheValue(trancheIdx: number, yearDivider = 1) {
      if (trancheIdx === 0) {
        return constants.Zero
      }
      const { targetApy } = tranchesData[trancheIdx]
      const initialDeposit = initialDeposits[trancheIdx]
      return withInterest(initialDeposit, targetApy, YEAR / yearDivider)
    }

    const getTrancheData = (trancheIdx: number): FixtureTrancheData => ({
      ...tranchesData[trancheIdx],
      initialDeposit: initialDeposits[trancheIdx],
      trancheIdx,
      calculateTargetValue: (yearDivider?: number) => calculateTargetTrancheValue(trancheIdx, yearDivider),
    })

    const senior = getTrancheData(2)
    const junior = getTrancheData(1)
    const equity = getTrancheData(0)

    return {
      ...portfolioFixtureResult,
      calculateTargetTrancheValue,
      withInterest,
      initialDeposits,
      senior,
      junior,
      equity,
      portfolioStartTx,
      portfolioStartTimestamp,
      totalDeposit,
    }
  }
}

export const structuredAssetVaultLiveFixture = getStructuredAssetVaultLiveFixture()
