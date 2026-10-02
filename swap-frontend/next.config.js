const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Limit build-trace collection to this app (prevents tracing into swap-backend,
  // which can hang/OOM the "Collecting build traces" step in a monorepo).
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Links in emails already sent point at these: they have no page of their own.
  async redirects() {
    return [
      { source: '/applicant', destination: '/applicant/dashboard', permanent: false },
      { source: '/recipient', destination: '/recipient/dashboard', permanent: false },
      { source: '/supervisor', destination: '/supervisor/dashboard', permanent: false },
      { source: '/admin', destination: '/admin/dashboard', permanent: false },
      { source: '/recipient/stipend/:id', destination: '/recipient/stipend', permanent: false },
    ]
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}

module.exports = nextConfig
