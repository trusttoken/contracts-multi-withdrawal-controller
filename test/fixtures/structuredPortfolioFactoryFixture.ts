import {
  DepositController,
  DepositController__factory,
  MockToken__factory,
  MultiWithdrawalController,
  MultiWithdrawalController__factory,
  StructuredPortfolioFactory__factory,
  StructuredPortfolioTest__factory,
  TrancheVaultTest,
  TrancheVaultTest__factory,
} from 'build/types'
import { BigNumberish, constants, Contract, ContractTransaction, utils, Wallet } from 'ethers'
import { DAY, YEAR } from 'utils/constants'
import { extractEventArgFromTx } from 'utils/extractEventArgFromTx'
import { deployFixedInterestOnlyLoans } from './deployFixedInterestOnlyLoans'
import { deployControllers } from 'fixtures/deployControllers'
import { deployProtocolConfig } from './deployProtocolConfig'
import { AllowAllLenderVerifier__factory } from 'build/types/factories/AllowAllLenderVerifier__factory'
import { TrancheData, TrancheInitData } from './types'

export interface PortfolioParams {
  name: string
  duration: number
  capitalFormationPeriod: number
  minimumSize: number
}

export const getStructuredPortfolioFactoryFixture = ({
  tokenDecimals = 6,
  initialTokens = [1e12, 1e10],
}: {
  tokenDecimals?: number
  initialTokens?: number[]
}) => {
  return async (wallets: Wallet[]) => {
    const [wallet] = wallets
    const token = await new MockToken__factory(wallet).deploy(tokenDecimals)

    const parseTokenUnits = (amount: string | number) => utils.parseUnits(amount.toString(), tokenDecimals)

    for (let index = 0; index < initialTokens.length; index++) {
      const amount = initialTokens[index]
      await token.mint(wallets[index].address, parseTokenUnits(amount))
    }

    const structuredPortfolioImplementation = await new StructuredPortfolioTest__factory(wallet).deploy()
    const trancheVaultImplementation = await new TrancheVaultTest__factory(wallet).deploy()

    const { protocolConfig, protocolConfigParams } = await deployProtocolConfig(wallet)

    const structuredPortfolioFactory = await new StructuredPortfolioFactory__factory(wallet).deploy(
      structuredPortfolioImplementation.address,
      trancheVaultImplementation.address,
      protocolConfig.address,
    )

    const whitelistedManagerRole = await structuredPortfolioFactory.WHITELISTED_MANAGER_ROLE()
    await structuredPortfolioFactory.grantRole(whitelistedManagerRole, wallet.address)

    const { fixedInterestOnlyLoans } = await deployFixedInterestOnlyLoans([wallet])

    const { depositController, withdrawController, transferController } = await deployControllers(wallet)

    const lenderVerifier = await new AllowAllLenderVerifier__factory(wallet).deploy()

    const sizes = [
      { floor: constants.Zero, ceiling: parseTokenUnits(5e9) },
      { floor: constants.Zero, ceiling: parseTokenUnits(5e9) },
      { floor: constants.Zero, ceiling: parseTokenUnits(1e10) },
    ]

    const equityTrancheInitData: TrancheInitData = {
      name: 'Equity Tranche',
      symbol: 'EQT',
      depositControllerImplementation: depositController.address,
      depositControllerInitData: depositController.interface.encodeFunctionData('initialize', [
        wallet.address,
        lenderVerifier.address,
        0,
        parseTokenUnits(1e10),
      ]),
      withdrawControllerImplementation: withdrawController.address,
      withdrawControllerInitData: withdrawController.interface.encodeFunctionData('initialize', [wallet.address, 1]),
      transferControllerImplementation: transferController.address,
      transferControllerInitData: transferController.interface.encodeFunctionData('initialize', [wallet.address]),
      targetApy: 0,
      minSubordinateRatio: 0,
      managerFeeRate: 0,
    }

    const juniorTrancheInitData: TrancheInitData = {
      name: 'Junior Tranche',
      symbol: 'JNT',
      depositControllerImplementation: depositController.address,
      depositControllerInitData: depositController.interface.encodeFunctionData('initialize', [
        wallet.address,
        lenderVerifier.address,
        0,
        parseTokenUnits(1e10),
      ]),
      withdrawControllerImplementation: withdrawController.address,
      withdrawControllerInitData: withdrawController.interface.encodeFunctionData('initialize', [wallet.address, 1]),
      transferControllerImplementation: transferController.address,
      transferControllerInitData: transferController.interface.encodeFunctionData('initialize', [wallet.address]),
      targetApy: 500,
      minSubordinateRatio: 0,
      managerFeeRate: 0,
    }

    const seniorTrancheInitData: TrancheInitData = {
      name: 'Senior Tranche',
      symbol: 'SNT',
      depositControllerImplementation: depositController.address,
      depositControllerInitData: depositController.interface.encodeFunctionData('initialize', [
        wallet.address,
        lenderVerifier.address,
        0,
        parseTokenUnits(1e10),
      ]),
      withdrawControllerImplementation: withdrawController.address,
      withdrawControllerInitData: withdrawController.interface.encodeFunctionData('initialize', [wallet.address, 1]),
      transferControllerImplementation: transferController.address,
      transferControllerInitData: transferController.interface.encodeFunctionData('initialize', [wallet.address]),
      targetApy: 300,
      minSubordinateRatio: 0,
      managerFeeRate: 0,
    }

    const tranchesInitData = [equityTrancheInitData, juniorTrancheInitData, seniorTrancheInitData]

    const portfolioDuration = 2 * YEAR

    const portfolioParams: PortfolioParams = {
      name: 'Portfolio',
      duration: portfolioDuration,
      capitalFormationPeriod: 90 * DAY,
      minimumSize: 0,
    }

    const expectedEquityRate = { from: 200, to: 2000 }

    async function createPortfolio(
      params: Partial<{
        token: Wallet | Contract
        fixedInterestOnlyLoans: Wallet | Contract
        portfolioParams: PortfolioParams
        tranchesInitData: TrancheInitData[]
        expectedEquityRate: { from: number; to: number }
      }> = {},
    ) {
      const args = {
        token,
        fixedInterestOnlyLoans,
        portfolioParams,
        tranchesInitData,
        expectedEquityRate,
        ...params,
      }
      const createPortfolioTx = await structuredPortfolioFactory.createPortfolio(
        args.token.address,
        args.fixedInterestOnlyLoans.address,
        args.portfolioParams,
        args.tranchesInitData,
        args.expectedEquityRate,
      )
      const portfolio = await getPortfolioFromTx(createPortfolioTx)

      return { portfolio, createPortfolioTx }
    }

    async function createPortfolioAndSetupControllers(...args: Parameters<typeof createPortfolio>) {
      const { portfolio, createPortfolioTx } = await createPortfolio(...args)
      const tranches = await getTranchesFromTx(createPortfolioTx)
      const controllers: { depositController: DepositController; withdrawController: MultiWithdrawalController }[] = []
      for (let i = 0; i < tranches.length; i++) {
        const depositControllerAddress = await tranches[i].depositController()
        const withdrawControllerAddress = await tranches[i].withdrawController()
        const depositController = DepositController__factory.connect(depositControllerAddress, wallet)
        const withdrawController = MultiWithdrawalController__factory.connect(withdrawControllerAddress, wallet)
        controllers.push({ depositController, withdrawController })
      }
      return { portfolio, tranches, createPortfolioTx, controllers }
    }

    const { createPortfolioTx } = await createPortfolio()

    const { timestamp: now } = await wallet.provider.getBlock('latest')
    const maxCapitalFormationDuration = 90 * DAY
    const startDeadline = now + maxCapitalFormationDuration

    const tranches = await getTranchesFromTx(createPortfolioTx)

    const tranchesData: TrancheData[] = []
    for (let i = 0; i < tranches.length; i++) {
      const depositControllerAddress = await tranches[i].depositController()
      const withdrawControllerAddress = await tranches[i].withdrawController()
      const depositController = DepositController__factory.connect(depositControllerAddress, wallet)
      const withdrawController = MultiWithdrawalController__factory.connect(withdrawControllerAddress, wallet)
      tranchesData.push({
        ...tranchesInitData[i],
        depositController,
        withdrawController,
      })

      await depositController.setCeiling(sizes[i].ceiling)
      await withdrawController.setFloor(sizes[i].floor)
    }

    async function depositToTranche(tranche: TrancheVaultTest, amount: BigNumberish, receiver = wallet) {
      await token.mint(receiver.address, amount)
      await token.connect(receiver).approve(tranche.address, amount)
      return tranche.connect(receiver).deposit(amount, receiver.address)
    }

    async function depositAndApproveToTranche(tranche: TrancheVaultTest, amount: BigNumberish, receiver = wallet) {
      await depositToTranche(tranche, amount, receiver)
      await tranche.connect(receiver).approve(tranchesData[0].withdrawController.address, amount)
    }

    async function mintToTranche(tranche: TrancheVaultTest, shares: BigNumberish, receiver = wallet.address) {
      await token.approve(tranche.address, constants.MaxUint256)
      return tranche.mint(shares, receiver)
    }

    async function getPortfolioFromTx(tx: ContractTransaction = createPortfolioTx) {
      const portfolioAddress: string = await extractEventArgFromTx(tx, [
        structuredPortfolioFactory.address,
        'PortfolioCreated',
        'newPortfolio',
      ])
      return new StructuredPortfolioTest__factory(wallet).attach(portfolioAddress)
    }

    async function getTranchesFromTx(tx: ContractTransaction = createPortfolioTx) {
      const tranchesAddresses: string[] = await extractEventArgFromTx(tx, [
        structuredPortfolioFactory.address,
        'PortfolioCreated',
        'tranches',
      ])
      return tranchesAddresses.map((address) => new TrancheVaultTest__factory(wallet).attach(address))
    }

    return {
      structuredPortfolioFactory,
      tranchesData,
      tranches,
      token,
      fixedInterestOnlyLoans,
      portfolioDuration,
      portfolioParams,
      createPortfolioTx,
      parseTokenUnits,
      depositToTranche,
      depositAndApproveToTranche,
      mintToTranche,
      getPortfolioFromTx,
      getTranchesFromTx,
      startDeadline,
      maxCapitalFormationDuration,
      equityTrancheData: tranchesData[0],
      juniorTrancheData: tranchesData[1],
      seniorTrancheData: tranchesData[2],
      whitelistedManagerRole,
      protocolConfig,
      protocolConfigParams,
      expectedEquityRate,
      tranchesInitData,
      createPortfolio,
      createPortfolioAndSetupControllers,
      lenderVerifier,
    }
  }
}

export const structuredPortfolioFactoryFixture = getStructuredPortfolioFactoryFixture({ tokenDecimals: 6 })
