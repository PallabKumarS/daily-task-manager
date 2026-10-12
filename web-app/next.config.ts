import type { NextConfig } from "next";

const isExport = process.env.NEXT_EXPORT === "true" || process.env.CAPACITOR_BUILD === "true";

const nextConfig: NextConfig = {
	allowedDevOrigins: ["127.0.0.1", "localhost", "127.0.0.1:3000", "localhost:3000"],
	output: isExport ? "export" : "standalone",
	distDir: isExport ? "../android-app/out" : undefined,
	trailingSlash: isExport ? true : false,
	images: {
		unoptimized: true,
	},
};

export default nextConfig;
