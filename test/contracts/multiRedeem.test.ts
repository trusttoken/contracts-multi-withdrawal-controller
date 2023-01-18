import { getBalances, parseBPS, parseUSDC, timeTravelTo, verifyBalances } from 'utils'
import { WithdrawalExceptionStruct } from 'contracts/MultiWithdrawalController'
import { PortfolioStatus, structuredPortfolioLiveFixture } from 'fixtures/structuredPortfolioFixture'
import { setupFixtureLoader } from 'test/setup'
import { expect } from 'chai'

describe('MultiWithdrawalController.multiRedeem', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(structuredPortfolioLiveFixture)

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
    const { equityTranche, equityTrancheData, token, other, another, depositAndApproveToTranche } = await loadFixture()
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
      await expect(equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)).to.revertedWith(
        'MWC: Only available when redemptions are disabled for lenders',
      )
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
