export default {
  requireModule: ['ts-node/register/transpile-only', 'tsconfig-paths/register'],
  require: ['features/**/*.ts'],
  format: ['html:reports/features-report.html'],
  publishQuiet: true
}
