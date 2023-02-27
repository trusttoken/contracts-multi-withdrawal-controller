import { defineParameterType, setDefaultTimeout, setWorldConstructor } from '@cucumber/cucumber'
import { ClaimableInterestWorld } from './claimableInterestWorld'
import { Actor } from './types'

const DEFAULT_TIMEOUT = 20_000 // 20 seconds

setDefaultTimeout(DEFAULT_TIMEOUT)
setWorldConstructor(ClaimableInterestWorld)
defineParameterType({
  name: 'usnumber',
  regexp: /[\d,.]+/,
  transformer: (usNumberAsString) => parseInt(usNumberAsString.replaceAll(',', '')),
})
defineParameterType({
  name: 'actor',
  regexp: /Alice|Bob|Charlie/,
  transformer: (actorsName) => actorsName as Actor,
})
