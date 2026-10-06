import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, "../assets");
const targetDir = path.resolve(__dirname, "../dist/assets");

if (fs.existsSync(sourceDir)) {
	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}

	const files = fs.readdirSync(sourceDir);
	for (const file of files) {
		const srcFile = path.join(sourceDir, file);
		const destFile = path.join(targetDir, file);
		const stat = fs.statSync(srcFile);

		if (stat.isFile()) {
			fs.copyFileSync(srcFile, destFile);
		}
	}
	console.log(`[Build] Copied ${files.length} asset(s) to ${targetDir}`);
} else {
	console.warn(`[Build] Source assets folder not found at ${sourceDir}`);
}
