import { DataTable, Given, Then, When } from '@cucumber/cucumber'
import { Actor } from './types'
import { ClaimableInterestWorld } from './claimableInterestWorld'
import { setupFixtureLoader } from '../../test/setup'
import { BigNumber, Wallet } from 'ethers'
import { getStructuredPortfolioLiveFixture } from 'fixtures/structuredPortfolioFixture'
import { expect } from 'chai'
import { DAY, parseUSDC } from 'utils'
import { Loan } from 'fixtures/setupLoansManagerHelpers'
import { WithdrawalExceptionStruct } from 'contracts/MultiWithdrawalController'
import { Zero } from '@ethersproject/constants'
import { FixtureConfig, WithdrawType } from 'fixtures/types'

function parseUsNumber(str: string): number {
  return parseFloat(str.replaceAll(',', ''))
}

const PRECISION = 0.001

Given('a Portfolio with MultiWithdrawController', async function (this: ClaimableInterestWorld) {
  const config: FixtureConfig = {
    tokenDecimals: 6,
    initialDeposits: [],
    initialTokens: [],
  }
  const loadFixture = setupFixtureLoader()
  const fixture = await loadFixture(getStructuredPortfolioLiveFixture(config))

  this.fixture = fixture
  const actors: Record<Actor, Wallet> = {
    Alice: fixture.otherWallets[0],
    Bob: fixture.otherWallets[1],
    Charlie: fixture.otherWallets[2],
  }
  this.getActor = (name: Actor) => actors[name]
})

interface Lender {
  name: Actor
  shares?: number
  assets?: number
  tokenBalance?: number
}

function toLenders(lendersTable: DataTable): Lender[] {
  return lendersTable.hashes().map((raw) => ({
    name: raw.name || 'Alice',
    shares: raw.shares && parseUsNumber(raw.shares),
    assets: raw.assets && parseUsNumber(raw.assets),
    tokenBalance: raw['token balance'] && parseUsNumber(raw['token balance']),
  }))
}

Given(/^lenders$/, async function (this: ClaimableInterestWorld, lendersTable: DataTable) {
  const lenders: Lender[] = toLenders(lendersTable)
  for (const lender of lenders) {
    const { assets, name, shares } = lender

    expect(await this.fixture.token.balanceOf(this.getActor(name).address)).to.be.closeTo(Zero, parseUSDC(PRECISION))
    await this.fixture.depositAndApproveToTranche(
      this.fixture.equityTranche,
      parseUSDC(assets || 0),
      this.getActor(name),
    )
    expect(await this.fixture.token.balanceOf(this.getActor(name).address)).to.be.closeTo(Zero, parseUSDC(PRECISION))

    await this.expectShares(name, shares)
    await this.expectAssets(name, assets)
  }
})

When('a loan is made and repaid', async function (this: ClaimableInterestWorld, loanDataTable: DataTable) {
  const { principal, interest } = loanDataTable.rowsHash()
  const { addAndFundLoan } = this.fixture

  const loan = createLoan(parseUSDC(parseUsNumber(principal)), parseUSDC(parseUsNumber(interest)), this.fixture.other)
  const loanId = await addAndFundLoan(loan)
  await this.fixture.repayLoanInFull(loanId, loan)
})

Then(/^portfolio has$/, async function (this: ClaimableInterestWorld, portfolioDataTable: DataTable) {
  const { shares, assets, 'share price': sharePrice } = portfolioDataTable.rowsHash()

  const portfolioShares = await this.fixture.equityTranche.totalSupply()
  const portfolioAssets = await this.fixture.equityTranche.totalAssets()

  shares && expect(portfolioShares).to.be.closeTo(parseUSDC(parseUsNumber(shares)), parseUSDC(PRECISION))
  assets && expect(portfolioAssets).to.be.closeTo(parseUSDC(parseUsNumber(assets)), parseUSDC(PRECISION))
  sharePrice &&
    expect(portfolioAssets.toNumber() / portfolioShares.toNumber()).to.be.closeTo(parseUsNumber(sharePrice), 0.01)
})

When(
  /^an interest disbursement is made$/,
  async function (this: ClaimableInterestWorld, disbursementDataTable: DataTable) {
    const disbursements: WithdrawalExceptionStruct[] = disbursementDataTable.hashes().map((disburseRow) => ({
      lender: this.getActor(disburseRow.name).address,
      assetAmount: parseUSDC(parseUsNumber(disburseRow.assets)),
      shareAmount: parseUSDC(parseUsNumber(disburseRow['shares burned'])),
      fee: Zero,
      withdrawType: WithdrawType.Interest,
    }))
    await this.fixture.equityTrancheData.withdrawController.multiRedeem(
      this.fixture.equityTranche.address,
      disbursements,
    )
  },
)

Then(/^lenders have$/, async function (this: ClaimableInterestWorld, lendersDataTable: DataTable) {
  const lenders = toLenders(lendersDataTable)

  for (const lender of lenders) {
    const { assets, name, shares, tokenBalance } = lender

    await this.expectShares(name, shares)
    await this.expectAssets(name, assets)
    tokenBalance &&
      expect(await this.fixture.token.balanceOf(this.getActor(name).address), `tokens of ${name}`).to.be.closeTo(
        parseUSDC(tokenBalance),
        parseUSDC(PRECISION),
      )
  }
})

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
Given('portfolio receives interest of {usnumber}', async function (this: ClaimableInterestWorld, interest: number) {
  const { addAndFundLoan } = this.fixture

  const loan = createLoan(parseUSDC(2000), parseUSDC(interest), this.fixture.other)
  const loanId = await addAndFundLoan(loan)
  await this.fixture.repayLoanInFull(loanId, loan)
})
