import type { NextConfig } from "next";

const SERVER_URL = process.env.SERVER_INTERNAL_URL;
const isExport = process.env.NEXT_EXPORT === "true" || process.env.CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
	allowedDevOrigins: ["127.0.0.1", "localhost", "127.0.0.1:3000", "localhost:3000"],
	output: isExport ? "export" : "standalone",
	distDir: isExport ? "../android-app/out" : undefined,
	images: {
		unoptimized: true,
	},
	...(!isExport
		? {
				async rewrites() {
					const target = process.env.SERVER_INTERNAL_URL || "http://127.0.0.1:49275";
					return [
						{
							source: "/api/v1/:path*",
							destination: `${target}/api/v1/:path*`,
						},
						{
							source: "/api/:path*",
							destination: `${target}/api/v1/:path*`,
						},
					];
				},
			}
		: {}),
};

export default nextConfig;
