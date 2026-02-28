#!/usr/bin/env node

/**
 * @fileoverview Main executable script linking the CLI input to the generator.
 */
import { runCli } from '../src/cli-core';

runCli(process.argv).then((success: boolean) => {
  if (!success) {
    process.exit(1);
  }
}).catch(() => {
  process.exit(1);
});