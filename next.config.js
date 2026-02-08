/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // basePath: '/task-manager', // Commented out for local development
  images: {
    unoptimized: true,
  },
  // Disable server-side features for static export
  trailingSlash: true,
}

module.exports = nextConfig
