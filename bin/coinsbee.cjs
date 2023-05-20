#!/usr/bin/env node

const cliModule = import("coinsbee/cli");

(async () => {
  const { runCLI } = await cliModule;
  await runCLI();
})().catch((err) => console.error(err));

