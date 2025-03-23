/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Disable type checking during the build process
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig