import '@typechain/hardhat'
import 'hardhat-waffle-dev'
import 'solidity-coverage'
import './abi-exporter'
import 'tsconfig-paths/register'
import 'hardhat-gas-reporter'

import mocharc from './.mocharc.json'
import compiler from './.compiler.json'

import { subtask } from 'hardhat/internal/core/config/config-env'
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names'
import path from 'path'

// eslint-disable-next-line turbo/no-undeclared-env-vars
const isCI = process.env.CI

// Override for CI to use downloaded solc compiler
// Based on: https://github.com/NomicFoundation/hardhat/issues/1639#issuecomment-876291261
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, (args: any, hre: any, runSuper: any) => {
  if (isCI && args.solcVersion === '0.8.16') {
    const compilerPath = path.join(__dirname, '..', '..', '..', 'tools-cache', 'hardhat', 'solc-v0.8.16')

    return {
      compilerPath,
      isSolcJs: false,
      version: args.solcVersion,
      longVersion: '0.8.16',
    }
  }

  // we just use the default subtask if the version is not 0.8.5
  return runSuper()
})

module.exports = {
  paths: {
    sources: './contracts',
    artifacts: './build',
    cache: './cache',
  },
  abiExporter: {
    path: './build',
    flat: true,
    spacing: 2,
  },
  networks: {
    hardhat: {
      initialDate: '2020-01-01T00:00:00Z',
      allowUnlimitedContractSize: true,
    },
  },
  typechain: {
    outDir: 'build/types',
    target: 'ethers-v5',
    dontOverrideCompile: true,
  },
  solidity: {
    compilers: [compiler],
  },
  mocha: {
    ...mocharc,
    timeout: 400000,
  },
  waffle: {
    skipEstimateGas: '0xB71B00',
    injectCallHistory: true,
  },
}
