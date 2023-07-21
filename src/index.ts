// Import Sentry and initialize it
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

// Export everything from the gas-price-oracle module
export * from '@/services/gas-price-oracle'
