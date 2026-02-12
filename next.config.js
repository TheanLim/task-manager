/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '/digital-date-night' : '';

const nextConfig = {
  output: 'export',
  basePath: basePath,
  images: {
    unoptimized: true,
  },
  // Disable server-side features for static export
  trailingSlash: true,
}

module.exports = nextConfig
