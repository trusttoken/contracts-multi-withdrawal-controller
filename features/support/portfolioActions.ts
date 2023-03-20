import { Actor, Fixture } from './types'
import { Wallet } from 'ethers'
import { parseUSDC } from 'utils'
import { expect } from 'chai'

const PRECISION = 0.001

class PortfolioActions {
  private currentActor: Wallet
  private actors: Record<Actor, Wallet>

  constructor(private fixture: Fixture) {
    this.actors = {
      Alice: fixture.otherWallets[0],
      Bob: fixture.otherWallets[1],
      Charlie: fixture.otherWallets[2],
    }
    this.currentActor = this.getActor('Alice')
  }

  as(actorName: Actor) {
    this.currentActor = this.getActor(actorName)
    return this
  }

  private getActor(actorName: Actor) {
    return this.actors[actorName]
  }

  async expectShares(shares?: number) {
    if (shares === undefined) return
    const lenderShares = await this.fixture.equityTranche.balanceOf(this.currentActor.address)

    expect(lenderShares, `shares of ${this.currentActorName()}`).to.be.closeTo(parseUSDC(shares), parseUSDC(PRECISION))
  }

  async expectAssets(assets?: number) {
    if (assets === undefined) return
    const lenderShares = await this.fixture.equityTranche.balanceOf(this.currentActor.address)
    const lenderAssets = await this.fixture.equityTranche.convertToAssets(lenderShares)

    expect(lenderAssets, `assets of ${this.currentActorName()}`).to.be.closeTo(parseUSDC(assets), parseUSDC(PRECISION))
  }

  private currentActorName() {
    const found = Object.entries(this.actors).find(([, { address }]) => address === this.currentActor.address)
    return found?.[0]
  }
}

export function using(fixture: Fixture) {
  return new PortfolioActions(fixture)
}
