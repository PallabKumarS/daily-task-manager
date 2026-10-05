import type { NextConfig } from "next";

const SERVER_URL = process.env.SERVER_INTERNAL_URL;

const nextConfig: NextConfig = {
	allowedDevOrigins: [
		"127.0.0.1",
		"localhost",
		"127.0.0.1:3000",
		"localhost:3000",
	],
	async rewrites() {
		if (!SERVER_URL) {
			return [];
		}
		return [
			{
				source: "/api/v1/:path*",
				destination: `${SERVER_URL}/api/v1/:path*`,
			},
			{
				source: "/api/:path*",
				destination: `${SERVER_URL}/api/v1/:path*`,
			},
		];
	},
};

export default nextConfig;
