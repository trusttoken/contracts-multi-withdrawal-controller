module.exports = {
  skipFiles: [
    './carbon',
  ],
  modifierWhitelist: ['initializer'],
  onCompileComplete: async () => {
    const { spawn } = require('child_process')
    const child = spawn('pnpm', ['build:typechain'])
    await new Promise((res, rej) => {
      child.on('exit', res)
      child.on('error', rej)
    });
  },
}
