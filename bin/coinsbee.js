#!/usr/bin/env node

'use strict'

const { PuppeteerCLI, createLogger } = require('base-puppeteer');
const yargs = require('yargs');

const logger = createLogger(require('../package').name);
const path = require('path');

const cli = new PuppeteerCLI({
  programName: 'coinsbee',
  puppeteerClassPath: path.join(__dirname, '..', 'lib', 'coinsbee'),
  logger
});
 
  
(async () => {
  if (yargs.argv.j) logger.info = () => {};
  await cli.runCLI();
})().catch((err) => {
  logger.error(err.stack);
  process.exit(1);
});
