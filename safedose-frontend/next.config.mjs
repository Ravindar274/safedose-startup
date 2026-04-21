/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,

  // Proxy all /api/* requests to the Express backend so frontend
  // fetch calls like fetch('/api/auth/login') keep working unchanged.
  async rewrites() {
    const apiBaseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const chatBaseUrl = process.env.CHAT_PROXY_URL || process.env.NEXT_PUBLIC_CHAT_PROXY_URL || 'http://localhost:5002';

    return [
      {
        source:      '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source:      '/chatservice/:path*',
        destination: `${process.env.CHAT_PROXY_URL || 'http://localhost:5002'}/:path*`,
      },
    ];
  },

  // Allow eval() in development — Next.js HMR and source maps require it.
  async headers() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key:   'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: ${process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:5002'};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
