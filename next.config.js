/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/task-manager',
  images: {
    unoptimized: true,
  },
  // Disable server-side features for static export
  trailingSlash: true,
}

module.exports = nextConfig
