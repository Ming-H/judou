/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    // pdfjs 在服务端(Node)抽取文本需保持外部包，避免 webpack 打包后 worker 相对路径失效
    serverComponentsExternalPackages: ['pdfjs-dist'],
  },
};

export default nextConfig;
