import { expect } from 'chai'
import { setupFixtureLoader } from 'test/setup'
import { ONE_HUNDRED_PERCENT, parseBPS, parseUSDC, timeTravelTo } from 'utils'
import { BigNumber, Wallet } from 'ethers'
import { WithdrawalExceptionStruct } from 'contracts/MultiWithdrawalController'
import { ERC20 } from 'contracts'
import {
  PortfolioStatus,
  structuredPortfolioFixture,
  structuredPortfolioLiveFixture,
} from 'fixtures/structuredPortfolioFixture'

describe('MultiWithdrawalController', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(structuredPortfolioLiveFixture)

  describe('multiRedeem', () => {
    it('withdraws funds for single lender', async () => {
      const { equityTranche, equityTrancheData, token, other, depositAndApproveToTranche } = await loadFixture()
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

      const balancesBefore = await getBalances(token, other)

      const exceptions: WithdrawalExceptionStruct[] = [
        { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50) },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const balancesAfter = await getBalances(token, other)
      verifyBalances(balancesBefore, balancesAfter, [parseUSDC(50)])
    })

    it('withdraws funds for multiple lenders', async () => {
      const { equityTranche, equityTrancheData, token, other, another, depositAndApproveToTranche } =
        await loadFixture()
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), another)
      const balancesBefore = await getBalances(token, other, another)

      const exceptions: WithdrawalExceptionStruct[] = [
        { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50) },
        { lender: another.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50) },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const balancesAfter = await getBalances(token, other, another)
      verifyBalances(balancesBefore, balancesAfter, Array(2).fill(parseUSDC(50)))
    })

    it('correctly calculates fee', async () => {
      const { equityTranche, equityTrancheData, token, other, depositAndApproveToTranche } = await loadFixture()
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

      const tokenBalancesBefore = await getBalances(token, other)
      const shareBalancesBefore = await getBalances(equityTranche, other)

      const exceptions: WithdrawalExceptionStruct[] = [
        { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(10), shareAmount: parseUSDC(50) },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const tokenBalancesAfter = await getBalances(token, other)
      const shareBalancesAfter = await getBalances(equityTranche, other)
      verifyBalances(tokenBalancesBefore, tokenBalancesAfter, [parseUSDC(45)])
      verifyBalances(shareBalancesBefore, shareBalancesAfter, [parseUSDC(50)])
    })

    describe('when a floor is configured', () => {
      it('reverts when remaining funds are below floor', async () => {
        const { equityTranche, equityTrancheData, equity, other, depositAndApproveToTranche } = await loadFixture()
        await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
        await equityTrancheData.withdrawController.setFloor(equity.initialDeposit.add(parseUSDC(120)))

        const exceptions: WithdrawalExceptionStruct[] = [
          { lender: other.address, sharePrice: parseBPS(400), fee: parseBPS(10), shareAmount: parseUSDC(20.1) },
        ]
        await expect(
          equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions),
        ).to.be.revertedWith('TV: Amount exceeds max redeem')
      })

      it('calculates redemption amount factoring in floor, fee and share price', async () => {
        const { equityTranche, equityTrancheData, other, token, depositAndApproveToTranche } = await loadFixture()
        await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
        await equityTrancheData.withdrawController.setFloor(parseUSDC(120))

        const tokenBalancesBefore = await getBalances(token, other)

        const exceptions: WithdrawalExceptionStruct[] = [
          { lender: other.address, sharePrice: parseBPS(400), fee: parseBPS(10), shareAmount: parseUSDC(20) },
        ]
        await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

        const tokenBalancesAfter = await getBalances(token, other)
        verifyBalances(tokenBalancesBefore, tokenBalancesAfter, [parseUSDC(72)])
      })
    })

    describe('works only if withdrawals are disabled for lenders', () => {
      it('fails if withdrawals are enabled', async () => {
        const { equityTranche, equityTrancheData, other, depositAndApproveToTranche } = await loadFixture()
        await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

        await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.Live)

        const exceptions: WithdrawalExceptionStruct[] = [
          { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50) },
        ]
        await expect(
          equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions),
        ).to.revertedWith('MWC: Only available when redemptions are disabled for lenders')
      })

      it('works after portfolio end date', async () => {
        const {
          structuredPortfolio,
          equityTranche,
          equityTrancheData,
          token,
          other,
          depositAndApproveToTranche,
          provider,
        } = await loadFixture()
        await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

        await equityTrancheData.withdrawController.setWithdrawAllowed(false, PortfolioStatus.Closed)
        await timeTravelTo(provider, (await structuredPortfolio.endDate()).add(100).toNumber())
        const balancesBefore = await getBalances(token, other)

        const exceptions: WithdrawalExceptionStruct[] = [
          { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50) },
        ]
        await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

        const balancesAfter = await getBalances(token, other)
        verifyBalances(balancesBefore, balancesAfter, [parseUSDC(50)])
      })
    })
  })

  describe('onWithdraw', () => {
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

  describe('maxWithdraw', () => {
    describe('when withdrawal is allowed, with a floor', () => {
      it('returns available amount over floor', async () => {
        const { equityTranche, equityTrancheData, wallet, depositToTranche } = await fixtureLoader(
          structuredPortfolioFixture,
        )
        await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.Live)

        await depositToTranche(equityTranche, parseUSDC(100), wallet)
        await equityTrancheData.withdrawController.setFloor(parseUSDC(30))

        expect(await equityTranche.maxWithdraw(wallet.address)).to.eq(parseUSDC(70))
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

  describe('onRedeem', () => {
    describe('when redeeming based on exception', () => {
      it('reverts if called by lender', async () => {
        const { redeemFromTranche, equityTranche } = await loadFixture()
        await expect(redeemFromTranche(equityTranche, parseUSDC(50))).to.be.revertedWith(
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
        } = await fixtureLoader(structuredPortfolioFixture)

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
  })

  describe('maxRedeem', () => {
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
})

export const getBalances = (token: ERC20, ...wallets: Wallet[]) => {
  const balances = wallets.map((wallet) => token.balanceOf(wallet.address))
  return Promise.all(balances)
}

export const verifyBalances = (
  balancesBefore: BigNumber[],
  balancesAfter: BigNumber[],
  expectedBalanceDifference: BigNumber[],
  fee?: BigNumber,
) => {
  balancesBefore.forEach((balanceBefore, index) => {
    const oneHundredPercent = BigNumber.from(ONE_HUNDRED_PERCENT)
    const multiplier = fee ? oneHundredPercent.sub(fee) : oneHundredPercent

    const difference = expectedBalanceDifference[index].mul(multiplier).div(ONE_HUNDRED_PERCENT)
    expect(balancesAfter[index].sub(balanceBefore).abs()).to.be.closeTo(difference, 1)
  })
}
