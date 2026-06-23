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
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}

module.exports = nextConfig
