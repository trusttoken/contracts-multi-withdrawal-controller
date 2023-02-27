import { FixtureReturns } from '../../test/setup'
import { getStructuredPortfolioLiveFixture } from 'fixtures/structuredPortfolioFixture'

export type Actor = 'Alice' | 'Bob' | 'Charlie'
export type Fixture = Awaited<ReturnType<ReturnType<typeof getStructuredPortfolioLiveFixture>>> & FixtureReturns
