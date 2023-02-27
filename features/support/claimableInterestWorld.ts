import { World } from '@cucumber/cucumber'
import { Actor, Fixture } from './types'
import { Wallet } from 'ethers'
import { using } from './portfolioActions'

export class ClaimableInterestWorld extends World {
  fixture!: Fixture
  getActor!: (name: Actor) => Wallet
  activeLoan!: { principal: number; loanId: number; interest: number }

  async expectShares(actorName: Actor, shares?: number) {
    await using(this.fixture).as(actorName).expectShares(shares)
  }

  async expectAssets(actorName: Actor, assets: number | undefined) {
    await using(this.fixture).as(actorName).expectAssets(assets)
  }
}
