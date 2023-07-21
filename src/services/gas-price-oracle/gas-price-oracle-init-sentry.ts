// gasPriceOracleInit.ts

import * as Sentry from "@sentry/browser";

let isSentryInitialized = false;

export function initializeSentry(dsn: string) {
  Sentry.init({
    dsn,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  // after sentry has initialized
  isSentryInitialized = true;
}

export function isSentryReady(): boolean {
  console.log("isSentryReady: running...")
  return isSentryInitialized;
}
