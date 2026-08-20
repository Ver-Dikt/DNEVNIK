/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  reactStrictMode: true,
  output: isGithubPages ? "export" : undefined,
  basePath: isGithubPages ? "/DNEVNIK" : undefined,
  assetPrefix: isGithubPages ? "/DNEVNIK/" : undefined,
  trailingSlash: isGithubPages
};

export default nextConfig;
