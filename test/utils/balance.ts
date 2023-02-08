import { expect } from 'chai'
import { ONE_HUNDRED_PERCENT } from 'utils'
import { BigNumber, Wallet } from 'ethers'
import { ERC20 } from 'contracts'

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
    expect(balancesAfter[index].sub(balanceBefore).abs()).to.eq(difference)
  })
}
