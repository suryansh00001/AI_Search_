/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  // DISABLE ALL CACHING TO FORCE FRESH BUILDS
  webpack: (config) => {
    config.cache = false;
    return config;
  },
}

module.exports = nextConfig
