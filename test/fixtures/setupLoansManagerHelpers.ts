import {
  FixedInterestOnlyLoans,
  LoansManagerTest,
  StructuredPortfolio,
  StructuredAssetVault,
  MockToken,
} from 'build/types'
import { Wallet, BigNumber, constants } from 'ethers'
import { DAY } from 'utils/constants'
import { extractEventArgFromTx } from 'utils/extractEventArgFromTx'
import { utils } from 'ethers'

export interface Loan {
  principal: BigNumber
  periodCount: number
  periodPayment: BigNumber
  periodDuration: number
  recipient: string
  gracePeriod: number
  canBeRepaidAfterDefault: boolean
}

async function getBasicLoan(borrower: Wallet, token: MockToken): Promise<Loan> {
  return {
    principal: utils.parseUnits('100000', await token.decimals()),
    periodCount: 1,
    periodPayment: utils.parseUnits('100', await token.decimals()),
    periodDuration: DAY,
    recipient: borrower.address,
    gracePeriod: DAY,
    canBeRepaidAfterDefault: true,
  }
}

export async function setupLoansManagerHelpers(
  loansManager: LoansManagerTest | StructuredPortfolio,
  fixedInterestOnlyLoans: FixedInterestOnlyLoans,
  borrower: Wallet,
  token: MockToken,
) {
  const basicLoan = await getBasicLoan(borrower, token)

  async function addLoan(loan: Loan = basicLoan) {
    const tx = await loansManager.addLoan(loan)
    const loanId: BigNumber = await extractEventArgFromTx(tx, [loansManager.address, 'LoanAdded', 'loanId'])
    return loanId
  }

  async function addAndAcceptLoan(loan: Loan = basicLoan) {
    const loanId = await addLoan(loan)
    await fixedInterestOnlyLoans.connect(borrower).acceptLoan(loanId)
    return loanId
  }

  async function addAndFundLoan(loan: Loan = basicLoan) {
    const loanId = await addAndAcceptLoan(loan)
    await loansManager.fundLoan(loanId)
    return loanId
  }

  function getLoan(loan: Partial<Loan>) {
    return { ...basicLoan, ...loan }
  }

  async function repayLoanInFull(loanId: BigNumber, loan: Loan = basicLoan) {
    await token.mint(borrower.address, getFullRepayAmount(loan))
    await token.connect(borrower).approve(loansManager.address, constants.MaxUint256)
    for (let i = 0; i < loan.periodCount; i++) {
      await loansManager.connect(borrower).repayLoan(loanId)
    }
  }

  function getFullRepayAmount(loan: Loan = basicLoan) {
    return loan.principal.add(loan.periodPayment.mul(loan.periodCount))
  }

  return { loan: basicLoan, addLoan, addAndAcceptLoan, addAndFundLoan, getLoan, repayLoanInFull, getFullRepayAmount }
}

export async function setupAssetVaultLoansHelper(vault: StructuredAssetVault, borrower: Wallet, token: MockToken) {
  let loansCount = constants.Zero

  const basicLoan = await getBasicLoan(borrower, token)

  function addLoan(loan: Loan = basicLoan) {
    const loanId = loansCount
    loansCount = loansCount.add(1)
    return loanId
  }

  function addAndAcceptLoan(loan: Loan = basicLoan) {
    const loanId = addLoan(loan)
    return loanId
  }

  async function addAndFundLoan(loan: Loan = basicLoan) {
    const loanId = addAndAcceptLoan(loan)
    await vault.disburse(borrower.address, loan.principal, loanId._hex)
    return loanId
  }

  function getLoan(loan: Partial<Loan>) {
    return {
      ...basicLoan,
      ...loan,
    }
  }

  async function repayLoanInFull(loanId: BigNumber, loan: Loan = basicLoan) {
    await token.mint(borrower.address, getFullRepayAmount(loan))
    await token.connect(borrower).approve(vault.address, constants.MaxUint256)
    for (let i = 1; i <= loan.periodCount; i++) {
      const repaidPrincipal = i === loan.periodCount ? loan.principal : constants.Zero
      await vault.updateState(loan.periodPayment.add(await vault.outstandingAssets()), `${loanId._hex}-${i}-update`)
      await vault.connect(borrower).repay(repaidPrincipal, loan.periodPayment, `${loanId._hex}-${i}-repay`)
    }
  }

  function getFullRepayAmount(loan: Loan = basicLoan) {
    return loan.principal.add(loan.periodPayment.mul(loan.periodCount))
  }

  return { loan: basicLoan, addLoan, addAndAcceptLoan, addAndFundLoan, getLoan, repayLoanInFull, getFullRepayAmount }
}
