import { SECOND } from 'utils/constants'

export const toUnixTimestamp = (timestamp: number) => Math.floor(timestamp / SECOND)
