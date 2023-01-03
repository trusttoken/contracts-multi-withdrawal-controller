import { ContractTransaction } from 'ethers'

type MaybePromise<T> = T | Promise<T>

export const extractArgFromTx = async (
  pendingTx: MaybePromise<ContractTransaction>,
  ...argFilters: [string, string, string][]
): Promise<any> => {
  const tx = await pendingTx
  const receipt = await tx.wait()
  const events = receipt.events
  for (const filter of argFilters) {
    const [_address, _event, _argName] = filter
    const eventLookup = events?.filter(({ address }) => address === _address).find(({ event }) => event === _event)
    if (eventLookup !== undefined) {
      return eventLookup.args?.[_argName]
    }
  }
}
