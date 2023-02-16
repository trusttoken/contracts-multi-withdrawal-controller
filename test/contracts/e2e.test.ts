import { DAY, getBalances, parseBPS, parseUSDC, verifyBalances } from 'utils'
import { setupFixtureLoader } from '../setup'
import { WithdrawalExceptionStruct } from 'contracts/MultiWithdrawalController'
import { expect } from 'chai'
import { BigNumber, Wallet } from 'ethers'
import { structuredPortfolioFixture, WithdrawType } from 'fixtures/structuredPortfolioFixture'
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
      const interest = parseUSDC(25)

      const exceptions: WithdrawalExceptionStruct[] = [
        {
          lender: wallet.address,
          assetAmount: interest,
          fee: interestWithdrawalFee,
          shareAmount: await equityTranche.convertToShares(interest),
          withdrawType: WithdrawType.Interest,
        },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const balancesAfter = await getBalances(token, wallet)
      verifyBalances(balancesBefore, balancesAfter, [interest])

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

      const principal = parseUSDC(100)
      await depositAndApproveToTranche(equityTranche, principal, another)
      await token.mint(other.address, parseUSDC(200))
      await startPortfolioAndEnableLiveActions()

      const loan = createLoan(parseUSDC(100), parseUSDC(25), other)
      const loanId = await addAndFundLoan(loan)
      await repayLoanInFull(loanId, loan)

      const lenderShares = await equityTranche.balanceOf(another.address)
      const lenderAssets = await equityTranche.convertToAssets(lenderShares)
      expect(lenderShares).to.be.eq(principal)
      expect(lenderAssets).to.be.eq(parseUSDC(125))

      const balancesBefore = await getBalances(token, another)

      const exceptions: WithdrawalExceptionStruct[] = [
        {
          lender: another.address,
          assetAmount: principal,
          fee: principalWithdrawalFee,
          shareAmount: await equityTranche.convertToShares(principal),
          withdrawType: WithdrawType.Principal,
        },
      ]
      await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

      const balancesAfter = await getBalances(token, another)
      verifyBalances(balancesBefore, balancesAfter, [principal], principalWithdrawalFee)

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
    const firstLenderInterest = parseUSDC(4)
    const secondLenderInterest = parseUSDC(16)

    const exceptions: WithdrawalExceptionStruct[] = [
      {
        lender: another.address,
        assetAmount: firstLenderInterest,
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(firstLenderInterest),
        withdrawType: WithdrawType.Interest,
      },
      {
        lender: other.address,
        assetAmount: secondLenderInterest,
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(secondLenderInterest),
        withdrawType: WithdrawType.Interest,
      },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

    const balancesAfter = await getBalances(token, another, other)
    verifyBalances(balancesBefore, balancesAfter, [firstLenderInterest, secondLenderInterest])

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

    const firstLenderPrincipal = parseUSDC(100)
    const secondLenderPrincipal = parseUSDC(400)
    await depositAndApproveToTranche(equityTranche, firstLenderPrincipal, another)
    await depositAndApproveToTranche(equityTranche, secondLenderPrincipal, other)
    await startPortfolioAndEnableLiveActions()

    const loan = createLoan(parseUSDC(200), parseUSDC(20), other)
    const loanId = await addAndFundLoan(loan)
    await repayLoanInFull(loanId, loan)

    const balancesBefore = await getBalances(token, another, other)

    const exceptions: WithdrawalExceptionStruct[] = [
      {
        lender: another.address,
        assetAmount: firstLenderPrincipal,
        fee: principalWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(firstLenderPrincipal),
        withdrawType: WithdrawType.Principal,
      },
      {
        lender: other.address,
        assetAmount: secondLenderPrincipal,
        fee: principalWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(secondLenderPrincipal),
        withdrawType: WithdrawType.Principal,
      },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

    const balancesAfter = await getBalances(token, another, other)
    verifyBalances(balancesBefore, balancesAfter, [firstLenderPrincipal, secondLenderPrincipal], principalWithdrawalFee)

    await verifyAssetsAfterWithdrawal(equityTranche, another, parseUSDC(4))
    await verifyAssetsAfterWithdrawal(equityTranche, other, parseUSDC(16))
  })

  it('blocking interest withdrawal does not change newly deposited asset value', async () => {
    const {
      equityTranche,
      equityTrancheData,
      wallet,
      token,
      other,
      another,
      addAndFundLoan,
      repayLoanInFull,
      depositAndApproveToTranche,
      startPortfolioAndEnableLiveActions,
    } = await loadFixture()

    const principal = parseUSDC(100)
    const interest = parseUSDC(4)
    await depositAndApproveToTranche(equityTranche, principal, another)
    await depositAndApproveToTranche(equityTranche, parseUSDC(400), other)
    await startPortfolioAndEnableLiveActions()

    const loan = createLoan(parseUSDC(200), parseUSDC(20), other)
    const loanId = await addAndFundLoan(loan)
    await repayLoanInFull(loanId, loan)

    const anotherException: WithdrawalExceptionStruct[] = [
      {
        lender: another.address,
        assetAmount: interest,
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(interest),
        withdrawType: WithdrawType.Interest,
      },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, anotherException)
    expect(await token.balanceOf(another.address)).to.eq(interest)

    const remainingShares = await equityTranche.balanceOf(another.address)
    expect(await equityTranche.convertToAssets(remainingShares)).to.eq(principal)

    await depositAndApproveToTranche(equityTranche, parseUSDC(150), wallet)

    const otherException: WithdrawalExceptionStruct[] = [
      {
        lender: other.address,
        assetAmount: parseUSDC(16),
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(16)),
        withdrawType: WithdrawType.Interest,
      },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, otherException)

    await verifyAssetsAfterWithdrawal(equityTranche, another, parseUSDC(100))
    await verifyAssetsAfterWithdrawal(equityTranche, other, parseUSDC(400))
    await verifyAssetsAfterWithdrawal(equityTranche, wallet, parseUSDC(150))
  })

  it('withdraws all interest to single lender', async () => {
    const {
      equityTranche,
      equityTrancheData,
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

    const exceptions: WithdrawalExceptionStruct[] = [
      {
        lender: another.address,
        assetAmount: parseUSDC(20),
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(4)),
        withdrawType: WithdrawType.Interest,
      },
      {
        lender: other.address,
        assetAmount: 1,
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(16)),
        withdrawType: WithdrawType.Interest,
      },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

    await verifyAssetsAfterWithdrawal(equityTranche, another, parseUSDC(100))
    await verifyAssetsAfterWithdrawal(equityTranche, other, parseUSDC(400), 2)
  })

  it('changes to redeemed assets impacts all lenders', async () => {
    const {
      equityTranche,
      equityTrancheData,
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

    const exceptions: WithdrawalExceptionStruct[] = [
      {
        lender: another.address,
        assetAmount: parseUSDC(100),
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(4)),
        withdrawType: WithdrawType.Interest,
      },
      {
        lender: other.address,
        assetAmount: parseUSDC(4),
        fee: interestWithdrawalFee,
        shareAmount: await equityTranche.convertToShares(parseUSDC(16)),
        withdrawType: WithdrawType.Interest,
      },
    ]
    await equityTrancheData.withdrawController.multiRedeem(equityTranche.address, exceptions)

    const anotherAssets = await equityTranche.convertToAssets(await equityTranche.balanceOf(another.address))
    expect(anotherAssets).to.be.closeTo(parseUSDC(83.2), 1)
    const otherAssets = await equityTranche.convertToAssets(await equityTranche.balanceOf(other.address))
    expect(otherAssets).to.be.closeTo(parseUSDC(332.8), 1)
  })

  const verifyAssetsAfterWithdrawal = async (
    portfolio: TrancheVault,
    wallet: Wallet,
    expectedAssets: BigNumber,
    delta = 1,
  ) => {
    const lenderSharesAfter = await portfolio.balanceOf(wallet.address)
    const lenderAssetsAfter = await portfolio.convertToAssets(lenderSharesAfter)
    expect(lenderAssetsAfter).to.be.closeTo(expectedAssets, delta)
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
