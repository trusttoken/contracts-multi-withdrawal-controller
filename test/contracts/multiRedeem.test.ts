import { getBalances, parseBPS, parseUSDC, timeTravelTo, verifyBalances } from 'utils'
import { WithdrawalExceptionStruct } from 'contracts/MultiWithdrawalController'
import { PortfolioStatus, structuredPortfolioLiveFixture, WithdrawType } from 'fixtures/structuredPortfolioFixture'
import { setupFixtureLoader } from 'test/setup'
import { expect } from 'chai'
import { AddressZero, Zero } from '@ethersproject/constants'

describe('MultiWithdrawalController.multiRedeem', () => {
  const fixtureLoader = setupFixtureLoader()
  const loadFixture = () => fixtureLoader(structuredPortfolioLiveFixture)
  const withdrawType = WithdrawType.Interest

  it('withdraws funds for single lender', async () => {
    const { equityTranche, equityTrancheData, token, other, depositAndApproveToTranche } = await loadFixture()
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

    const balancesBefore = await getBalances(token, other)

    const exceptions: WithdrawalExceptionStruct[] = [
      { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50), withdrawType },
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
      { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50), withdrawType },
      {
        lender: another.address,
        sharePrice: parseBPS(100),
        fee: parseBPS(0),
        shareAmount: parseUSDC(50),
        withdrawType,
      },
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
      { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(10), shareAmount: parseUSDC(50), withdrawType },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

    const tokenBalancesAfter = await getBalances(token, other)
    const shareBalancesAfter = await getBalances(equityTranche, other)
    verifyBalances(tokenBalancesBefore, tokenBalancesAfter, [parseUSDC(45)])
    verifyBalances(shareBalancesBefore, shareBalancesAfter, [parseUSDC(50)])
  })

  it('removes withdrawal exception after execution', async () => {
    const { equityTranche, equityTrancheData, other, depositAndApproveToTranche } = await loadFixture()
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

    const exceptions: WithdrawalExceptionStruct[] = [
      { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50), withdrawType },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

    const exception = await equityTrancheData.withdrawController.withdrawalException()
    expect(exception.lender).to.eq(AddressZero)
    expect(exception.fee).to.eq(Zero)
    expect(exception.sharePrice).to.eq(Zero)
    expect(exception.shareAmount).to.eq(Zero)
  })

  it('emits event for each redemption', async () => {
    const { equityTranche, equityTrancheData, other, another, depositAndApproveToTranche } = await loadFixture()
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), another)

    const exceptions: WithdrawalExceptionStruct[] = [
      {
        lender: other.address,
        sharePrice: parseBPS(20),
        fee: Zero,
        shareAmount: parseUSDC(40),
        withdrawType: WithdrawType.Principal,
      },
      { lender: another.address, sharePrice: parseBPS(10), fee: Zero, shareAmount: parseUSDC(50), withdrawType },
    ]
    await expect(equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions))
      .to.emit(equityTrancheData.withdrawController, 'Redeem')
      .withArgs(
        exceptions[0].lender,
        equityTranche.address,
        exceptions[0].withdrawType,
        parseUSDC(8),
        exceptions[0].shareAmount,
      )
      .to.emit(equityTrancheData.withdrawController, 'Redeem')
      .withArgs(
        exceptions[1].lender,
        equityTranche.address,
        exceptions[1].withdrawType,
        parseUSDC(5),
        exceptions[1].shareAmount,
      )
  })

  it('reverts when share price in withdrawal exception is zero', async () => {
    const { equityTranche, equityTrancheData, other, depositAndApproveToTranche } = await loadFixture()
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

    const exceptions: WithdrawalExceptionStruct[] = [
      { lender: other.address, sharePrice: Zero, fee: parseBPS(10), shareAmount: parseUSDC(50), withdrawType },
    ]
    await expect(
      equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions),
    ).to.be.revertedWith('TV: Amount cannot be zero')
  })

  it('reverts when share amount in withdrawal exception is zero', async () => {
    const { equityTranche, equityTrancheData, other, depositAndApproveToTranche } = await loadFixture()
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

    const exceptions: WithdrawalExceptionStruct[] = [
      { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(10), shareAmount: Zero, withdrawType },
    ]
    await expect(
      equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions),
    ).to.be.revertedWith('TV: Amount cannot be zero')
  })

  it('reverts when withdrawal exception array is empty', async () => {
    const { equityTranche, equityTrancheData, other, depositAndApproveToTranche } = await loadFixture()
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

    await expect(equityTrancheData.withdrawController.multiRedeem(equityTranche.address, [])).to.be.revertedWith(
      'MWC: Exceptions array cannot be empty',
    )
  })

  it('reverts when called by lender', async () => {
    const { equityTranche, equityTrancheData, other, depositAndApproveToTranche } = await loadFixture()
    await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

    const exceptions: WithdrawalExceptionStruct[] = [
      { lender: other.address, sharePrice: parseBPS(100), fee: parseBPS(0), shareAmount: parseUSDC(50), withdrawType },
    ]
    await expect(
      equityTrancheData.withdrawController.connect(other).multiRedeem(equityTranche.address, exceptions),
    ).to.be.revertedWith('MWC: Only manager')
  })

  describe('when a floor is configured', () => {
    it('reverts when remaining funds are below floor', async () => {
      const { equityTranche, equityTrancheData, equity, other, depositAndApproveToTranche } = await loadFixture()
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
      await equityTrancheData.withdrawController.setFloor(equity.initialDeposit.add(parseUSDC(120)))

      const exceptions: WithdrawalExceptionStruct[] = [
        {
          lender: other.address,
          sharePrice: parseBPS(400),
          fee: parseBPS(10),
          shareAmount: parseUSDC(20),
          withdrawType,
        },
      ]
      await expect(
        equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions),
      ).to.be.revertedWith('MWC: Remaining amount below floor')
    })

    it('calculates redemption amount factoring in floor, fee and share price', async () => {
      const { equityTranche, equityTrancheData, other, token, depositAndApproveToTranche } = await loadFixture()
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
      await equityTrancheData.withdrawController.setFloor(parseUSDC(120))

      const tokenBalancesBefore = await getBalances(token, other)

      const exceptions: WithdrawalExceptionStruct[] = [
        {
          lender: other.address,
          sharePrice: parseBPS(400),
          fee: parseBPS(10),
          shareAmount: parseUSDC(20),
          withdrawType,
        },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const tokenBalancesAfter = await getBalances(token, other)
      verifyBalances(tokenBalancesBefore, tokenBalancesAfter, [parseUSDC(72)])
    })

    it('reverts if share price causes redemption to go below floor', async () => {
      const { equityTranche, equityTrancheData, equity, other, depositAndApproveToTranche } = await loadFixture()
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
      await equityTrancheData.withdrawController.setFloor(equity.initialDeposit.add(parseUSDC(50)))

      const exceptions: WithdrawalExceptionStruct[] = [
        {
          lender: other.address,
          sharePrice: parseBPS(200),
          fee: parseBPS(10),
          shareAmount: parseUSDC(49),
          withdrawType,
        },
      ]
      await expect(
        equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions),
      ).to.be.revertedWith('MWC: Remaining amount below floor')
    })

    it('does not revert if small share price takes a redemption above floor', async () => {
      const { equityTranche, equityTrancheData, equity, other, token, depositAndApproveToTranche } = await loadFixture()
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)
      await equityTrancheData.withdrawController.setFloor(equity.initialDeposit.add(parseUSDC(60)))

      const exceptions: WithdrawalExceptionStruct[] = [
        { lender: other.address, sharePrice: parseBPS(50), fee: Zero, shareAmount: parseUSDC(60), withdrawType },
      ]
      const balanceBefore = await getBalances(token, other)
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)
      verifyBalances(balanceBefore, await getBalances(token, other), [parseUSDC(30)])
    })
  })

  describe('works only if withdrawals are disabled for lenders', () => {
    it('fails if withdrawals are enabled', async () => {
      const { equityTranche, equityTrancheData, other, depositAndApproveToTranche } = await loadFixture()
      await depositAndApproveToTranche(equityTranche, parseUSDC(100), other)

      await equityTrancheData.withdrawController.setWithdrawAllowed(true, PortfolioStatus.Live)

      const exceptions: WithdrawalExceptionStruct[] = [
        {
          lender: other.address,
          sharePrice: parseBPS(100),
          fee: parseBPS(0),
          shareAmount: parseUSDC(50),
          withdrawType,
        },
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
        {
          lender: other.address,
          sharePrice: parseBPS(100),
          fee: parseBPS(0),
          shareAmount: parseUSDC(50),
          withdrawType,
        },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const balancesAfter = await getBalances(token, other)
      verifyBalances(balancesBefore, balancesAfter, [parseUSDC(50)])
    })
  })
})
