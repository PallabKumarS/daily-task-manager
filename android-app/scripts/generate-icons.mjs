import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "../..");
const srcMasterLogo = path.join(rootDir, "assets/google-app-logo.png");
const srcLogo = fs.existsSync(srcMasterLogo)
	? srcMasterLogo
	: path.join(rootDir, "assets/logo.png");
const resDir = path.join(rootDir, "android-app/android/app/src/main/res");

const densities = [
	{ name: "mipmap-mdpi", iconSize: 48, fgSize: 108, logoInFg: 72 },
	{ name: "mipmap-hdpi", iconSize: 72, fgSize: 162, logoInFg: 108 },
	{ name: "mipmap-xhdpi", iconSize: 96, fgSize: 216, logoInFg: 144 },
	{ name: "mipmap-xxhdpi", iconSize: 144, fgSize: 324, logoInFg: 216 },
	{ name: "mipmap-xxxhdpi", iconSize: 192, fgSize: 432, logoInFg: 288 },
];

async function generate() {
	if (!fs.existsSync(srcLogo)) {
		throw new Error(`Source logo not found at ${srcLogo}`);
	}

	// Prepare cropped emblem from high-res master
	const masterImg = sharp(srcLogo);
	const masterMeta = await masterImg.metadata();
	let emblemBuffer;
	if (masterMeta.width && masterMeta.width >= 1000) {
		emblemBuffer = await masterImg
			.extract({ left: 224, top: 224, width: 576, height: 576 })
			.png()
			.toBuffer();
	} else {
		emblemBuffer = await masterImg.png().toBuffer();
	}

	for (const d of densities) {
		const dir = path.join(resDir, d.name);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// 1. ic_launcher.png (legacy rounded square)
		const iconEmblemSize = Math.round(d.iconSize * 0.82);
		const iconEmblem = await sharp(emblemBuffer).resize(iconEmblemSize, iconEmblemSize).toBuffer();
		const iconOffset = Math.floor((d.iconSize - iconEmblemSize) / 2);

		const cornerRadius = Math.round(d.iconSize * 0.22);
		const rectMaskSvg = `<svg width="${d.iconSize}" height="${d.iconSize}"><rect width="${d.iconSize}" height="${d.iconSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#ffffff"/></svg>`;

		await sharp({
			create: {
				width: d.iconSize,
				height: d.iconSize,
				channels: 4,
				background: { r: 9, g: 13, b: 22, alpha: 1 },
			},
		})
			.composite([
				{ input: iconEmblem, top: iconOffset, left: iconOffset },
				{ input: Buffer.from(rectMaskSvg), blend: "dest-in" },
			])
			.png()
			.toFile(path.join(dir, "ic_launcher.png"));

		// 2. ic_launcher_round.png (legacy round)
		const radius = d.iconSize / 2;
		const circleMaskSvg = `<svg width="${d.iconSize}" height="${d.iconSize}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#ffffff"/></svg>`;

		await sharp({
			create: {
				width: d.iconSize,
				height: d.iconSize,
				channels: 4,
				background: { r: 9, g: 13, b: 22, alpha: 1 },
			},
		})
			.composite([
				{ input: iconEmblem, top: iconOffset, left: iconOffset },
				{ input: Buffer.from(circleMaskSvg), blend: "dest-in" },
			])
			.png()
			.toFile(path.join(dir, "ic_launcher_round.png"));

		// 3. ic_launcher_foreground.png (adaptive foreground)
		const fgRadius = d.logoInFg / 2;
		const fgCircleMask = `<svg width="${d.logoInFg}" height="${d.logoInFg}"><circle cx="${fgRadius}" cy="${fgRadius}" r="${fgRadius}" fill="#ffffff"/></svg>`;
		const fgEmblem = await sharp(emblemBuffer)
			.resize(d.logoInFg, d.logoInFg)
			.composite([{ input: Buffer.from(fgCircleMask), blend: "dest-in" }])
			.png()
			.toBuffer();
		const fgOffset = Math.floor((d.fgSize - d.logoInFg) / 2);

		await sharp({
			create: {
				width: d.fgSize,
				height: d.fgSize,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		})
			.composite([{ input: fgEmblem, top: fgOffset, left: fgOffset }])
			.png()
			.toFile(path.join(dir, "ic_launcher_foreground.png"));

		console.log(`[DayPulse Icons] Generated ${d.name} launcher icons`);
	}

	// 4. Generate splash screens for all drawable variants
	const splashVariants = [
		{ dir: "drawable", width: 480, height: 320 },
		{ dir: "drawable-land-mdpi", width: 480, height: 320 },
		{ dir: "drawable-land-hdpi", width: 800, height: 480 },
		{ dir: "drawable-land-xhdpi", width: 1280, height: 720 },
		{ dir: "drawable-land-xxhdpi", width: 1600, height: 960 },
		{ dir: "drawable-land-xxxhdpi", width: 1920, height: 1280 },
		{ dir: "drawable-port-mdpi", width: 320, height: 480 },
		{ dir: "drawable-port-hdpi", width: 480, height: 800 },
		{ dir: "drawable-port-xhdpi", width: 720, height: 1280 },
		{ dir: "drawable-port-xxhdpi", width: 960, height: 1600 },
		{ dir: "drawable-port-xxxhdpi", width: 1280, height: 1920 },
	];

	for (const sp of splashVariants) {
		const targetDir = path.join(resDir, sp.dir);
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		const logoDimension = Math.min(Math.round(Math.min(sp.width, sp.height) * 0.4), 256);
		const resizedLogo = await sharp(srcLogo).resize(logoDimension, logoDimension).toBuffer();

		const left = Math.floor((sp.width - logoDimension) / 2);
		const top = Math.floor((sp.height - logoDimension) / 2);

		await sharp({
			create: {
				width: sp.width,
				height: sp.height,
				channels: 4,
				background: { r: 9, g: 13, b: 22, alpha: 1 },
			},
		})
			.composite([{ input: resizedLogo, top, left }])
			.png()
			.toFile(path.join(targetDir, "splash.png"));

		console.log(`[DayPulse Icons] Generated splash.png for ${sp.dir}`);
	}
}

generate().catch((err) => {
	console.error("[DayPulse Icons] Generation error:", err);
	process.exit(1);
});
