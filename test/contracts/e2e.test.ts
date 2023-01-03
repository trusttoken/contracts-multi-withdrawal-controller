import { DAY, parseBPS, parseUSDC } from 'utils'
import { setupFixtureLoader } from '../setup'
import { WithdrawalExceptionStruct } from 'contracts/MultiWithdrawalController'
import { expect } from 'chai'
import { getBalances, verifyBalances } from './MultiWithdrawalController.test'
import { BigNumber, Wallet } from 'ethers'
import { structuredPortfolioFixture } from 'fixtures/structuredPortfolioFixture'
import { Loan } from 'fixtures/setupLoansManagerHelpers'
import { TrancheVault } from 'contracts'

describe('e2e', () => {
  const fixtureLoader = setupFixtureLoader()
  const principalWithdrawalFee = parseBPS(2)
  const interestWithdrawalFee = parseBPS(0)
  const loadFixture = () => fixtureLoader(structuredPortfolioFixture)

  describe('real life examples', () => {
    it('withdraws interest', async () => {
      const {
        equityTranche,
        startPortfolioAndEnableLiveActions,
        equityTrancheData,
        depositAndApproveToTranche,
        token,
        other,
        addAndFundLoan,
        wallet,
        repayLoanInFull,
      } = await loadFixture()

      await depositAndApproveToTranche(equityTranche, parseUSDC(100), wallet)
      await token.mint(other.address, parseUSDC(200))
      await startPortfolioAndEnableLiveActions()

      const loan = createLoan(parseUSDC(100), parseUSDC(25), other)
      const loanId = await addAndFundLoan(loan)
      await repayLoanInFull(loanId, loan)

      const lenderShares = await equityTranche.balanceOf(wallet.address)
      const lenderAssets = await equityTranche.convertToAssets(lenderShares)
      expect(lenderShares).to.be.eq(parseUSDC(100))
      expect(lenderAssets).to.be.eq(parseUSDC(125))

      const balancesBefore = await getBalances(token, wallet)

      const exceptions: WithdrawalExceptionStruct[] = [
        {
          lender: wallet.address,
          sharePrice: parseBPS(125),
          fee: interestWithdrawalFee,
          shareAmount: await equityTranche.convertToShares(parseUSDC(25)),
        },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const balancesAfter = await getBalances(token, wallet)
      verifyBalances(balancesBefore, balancesAfter, [parseUSDC(25)])

      const lenderSharesAfter = await equityTranche.balanceOf(wallet.address)
      const lenderAssetsAfter = await equityTranche.convertToAssets(lenderSharesAfter)
      expect(lenderSharesAfter).to.be.eq(parseUSDC(80))
      expect(lenderAssetsAfter).to.be.eq(parseUSDC(100))
    })

    it('withdraws principle', async () => {
      const {
        equityTranche,
        startPortfolioAndEnableLiveActions,
        equityTrancheData,
        depositAndApproveToTranche,
        token,
        other,
        another,
        addAndFundLoan,
        repayLoanInFull,
      } = await loadFixture()

      await depositAndApproveToTranche(equityTranche, parseUSDC(100), another)
      await token.mint(other.address, parseUSDC(200))
      await startPortfolioAndEnableLiveActions()

      const loan = createLoan(parseUSDC(100), parseUSDC(25), other)
      const loanId = await addAndFundLoan(loan)
      await repayLoanInFull(loanId, loan)

      const lenderShares = await equityTranche.balanceOf(another.address)
      const lenderAssets = await equityTranche.convertToAssets(lenderShares)
      expect(lenderShares).to.be.eq(parseUSDC(100))
      expect(lenderAssets).to.be.eq(parseUSDC(125))

      const balancesBefore = await getBalances(token, another)

      const exceptions: WithdrawalExceptionStruct[] = [
        {
          lender: another.address,
          sharePrice: parseBPS(125),
          fee: principalWithdrawalFee,
          shareAmount: await equityTranche.convertToShares(parseUSDC(100)),
        },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const balancesAfter = await getBalances(token, another)
      verifyBalances(balancesBefore, balancesAfter, [parseUSDC(100)], principalWithdrawalFee)

      const lenderSharesAfter = await equityTranche.balanceOf(another.address)
      const lenderAssetsAfter = await equityTranche.convertToAssets(lenderSharesAfter)
      expect(lenderSharesAfter).to.be.eq(parseUSDC(20))
      expect(lenderAssetsAfter).to.be.eq(parseUSDC(25))
    })
  })

  it('withdraws interest for multiple lenders', async () => {
    const {
      equityTranche,
      equityTrancheData,
      token,
      other,
      another,
      addAndFundLoan,
      repayLoanInFull,
      depositAndApproveToTranche,
      startPortfolioAndEnableLiveActions,
    } = await loadFixture()

    await depositAndApproveToTranche(equityTranche, parseUSDC(100), another)
    await depositAndApproveToTranche(equityTranche, parseUSDC(400), other)
    await startPortfolioAndEnableLiveActions()

    const loan = createLoan(parseUSDC(200), parseUSDC(20), other)
    const loanId = await addAndFundLoan(loan)
    await repayLoanInFull(loanId, loan)

    const balancesBefore = await getBalances(token, another, other)

    const exceptions: WithdrawalExceptionStruct[] = [
      {
        lender: another.address,
        sharePrice: parseBPS(104),
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(4)),
      },
      {
        lender: other.address,
        sharePrice: parseBPS(104),
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(16)),
      },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

    const balancesAfter = await getBalances(token, another, other)
    verifyBalances(balancesBefore, balancesAfter, [parseUSDC(4), parseUSDC(16)])

    await verifyAssetsAfterWithdrawal(equityTranche, another, parseUSDC(100))
    await verifyAssetsAfterWithdrawal(equityTranche, other, parseUSDC(400))
  })

  it('withdraws principal for multiple lenders', async () => {
    const {
      equityTranche,
      equityTrancheData,
      token,
      other,
      another,
      addAndFundLoan,
      repayLoanInFull,
      depositAndApproveToTranche,
      startPortfolioAndEnableLiveActions,
    } = await loadFixture()

    await depositAndApproveToTranche(equityTranche, parseUSDC(100), another)
    await depositAndApproveToTranche(equityTranche, parseUSDC(400), other)
    await startPortfolioAndEnableLiveActions()

    const loan = createLoan(parseUSDC(200), parseUSDC(20), other)
    const loanId = await addAndFundLoan(loan)
    await repayLoanInFull(loanId, loan)

    const balancesBefore = await getBalances(token, another, other)

    const exceptions: WithdrawalExceptionStruct[] = [
      {
        lender: another.address,
        sharePrice: parseBPS(104),
        fee: principalWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(100)),
      },
      {
        lender: other.address,
        sharePrice: parseBPS(104),
        fee: principalWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(400)),
      },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

    const balancesAfter = await getBalances(token, another, other)
    verifyBalances(balancesBefore, balancesAfter, [parseUSDC(100), parseUSDC(400)], principalWithdrawalFee)

    await verifyAssetsAfterWithdrawal(equityTranche, another, parseUSDC(4))
    await verifyAssetsAfterWithdrawal(equityTranche, other, parseUSDC(16))
  })

  const verifyAssetsAfterWithdrawal = async (portfolio: TrancheVault, wallet: Wallet, expectedAssets: BigNumber) => {
    const lenderSharesAfter = await portfolio.balanceOf(wallet.address)
    const lenderAssetsAfter = await portfolio.convertToAssets(lenderSharesAfter)
    expect(lenderAssetsAfter).to.be.closeTo(expectedAssets, 1)
  }

  const createLoan = (principal: BigNumber, periodPayment: BigNumber, recipient: Wallet): Loan => {
    return {
      principal: principal,
      periodPayment: periodPayment,
      periodCount: 1,
      periodDuration: DAY,
      recipient: recipient.address,
      gracePeriod: DAY,
      canBeRepaidAfterDefault: true,
    }
  }
})
