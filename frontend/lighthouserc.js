// File: frontend/lighthouserc.js
// Lighthouse CI Configuration — Sprint 6 Frozen Contract
// Thresholds: Performance ≥90, Accessibility 100, Best Practices ≥90, SEO ≥90

// Upload: temporary-public-storage for CI artifact sharing

/* eslint-env node */

const config = {
  ci: {
    collect: [
      {
        url: 'http://localhost:5173/',
        numberOfRuns: 3,
        settings: {
          preset: 'desktop',
          // Throttle to simulate typical desktop conditions
          throttling: {
            cpuSlowdownMultiplier: 1,
          },
        },
      },
    ],
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 1.0 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],

        // Performance metric budgets (SDD §8.3)
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'interactive': ['error', { maxNumericValue: 3000 }],

        // Ensure no render-blocking resources
        'render-blocking-resources': 'warn',

        // Image optimization
        'uses-optimized-images': 'warn',
        'uses-responsive-images': 'warn',

        // Bundle size hints
        'total-byte-weight': ['warn', { maxNumericValue: 500000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

module.exports = config;