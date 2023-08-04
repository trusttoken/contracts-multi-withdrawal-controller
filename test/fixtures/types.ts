import { FixtureReturns } from 'test/setup'
import { BigNumber, BigNumberish, BytesLike, ContractTransaction, Wallet } from 'ethers'
import { DepositController, MockToken, MultiWithdrawalController, TrancheVaultTest } from 'build/types'
import { Loan } from './setupLoansManagerHelpers'

export interface FixtureConfig {
  tokenDecimals: number
  initialDeposits: number[]
  initialTokens: number[]
}

export enum PortfolioStatus {
  CapitalFormation,
  Live,
  Closed,
}

export enum WithdrawType {
  Interest,
  Principal,
}

export interface TrancheInitData {
  name: string
  symbol: string
  depositControllerImplementation: string
  depositControllerInitData: BytesLike
  withdrawControllerImplementation: string
  withdrawControllerInitData: BytesLike
  transferControllerImplementation: string
  transferControllerInitData: BytesLike
  targetApy: number
  minSubordinateRatio: number
  managerFeeRate: number
}

export interface TrancheData extends TrancheInitData {
  depositController: DepositController
  withdrawController: MultiWithdrawalController
}

export interface FixtureTrancheData extends TrancheData {
  initialDeposit: BigNumber
  trancheIdx: number
  calculateTargetValue: (yearDivider?: number) => BigNumber
}

type PromiseOrValue<T> = Promise<T> | T

export interface Fixture extends FixtureReturns {
  equityTrancheData: TrancheData
  juniorTrancheData: TrancheData
  seniorTrancheData: TrancheData
  equityTranche: TrancheVaultTest
  juniorTranche: TrancheVaultTest
  seniorTranche: TrancheVaultTest
  token: MockToken
  startAndClosePortfolio: () => PromiseOrValue<void>
  startPortfolioAndEnableLiveActions: () => PromiseOrValue<ContractTransaction>
  depositToTranche: (
    tranche: TrancheVaultTest,
    amount: BigNumberish,
    receiver?: Wallet,
  ) => PromiseOrValue<ContractTransaction>
  depositAndApproveToTranche: (
    tranche: TrancheVaultTest,
    amount: BigNumberish,
    receiver?: Wallet,
  ) => PromiseOrValue<void>
  addAndFundLoan: (loan: Loan) => PromiseOrValue<BigNumber>
  repayLoanInFull: (loanId: BigNumber, loan: Loan) => Promise<void>
  redeemFromTranche: (
    tranche: TrancheVaultTest,
    amount: BigNumberish,
    owner?: string,
    receiver?: string,
  ) => PromiseOrValue<ContractTransaction>
  withdrawFromTranche: (
    tranche: TrancheVaultTest,
    amount: BigNumberish,
    owner?: string,
    receiver?: string,
  ) => PromiseOrValue<ContractTransaction>
  updateCheckpoints: () => PromiseOrValue<ContractTransaction>
  getPortfolioTotalAssets: () => PromiseOrValue<BigNumber>
  getPortfolioVirtualTokenBalance: () => PromiseOrValue<BigNumber>
  getPortfolioEndDate: () => PromiseOrValue<BigNumber>
  getLoan: (loan: Partial<Loan>) => Loan
}

export interface LiveFixture extends Fixture {
  equity: FixtureTrancheData
  junior: FixtureTrancheData
  senior: FixtureTrancheData
}
