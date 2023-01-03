import { BigNumber, BigNumberish } from 'ethers'

export const parseBPS = (amount: BigNumberish) => BigNumber.from(amount).mul(100)
