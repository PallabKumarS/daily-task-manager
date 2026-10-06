import JSZip from "jszip";

export interface BackupArchiveManifest {
	formatVersion: number;
	appName: string;
	exportedAt: string;
	user: {
		id: string;
		name: string;
		email: string;
		currency: string;
	} | null;
	counts: {
		tasks: number;
		routines: number;
		routineLogs: number;
		transactions: number;
		trackers: number;
		trackerLogs: number;
		categories: number;
	};
	checksums: Record<string, string>;
}

export function base64ToBlob(base64: string, mimeType = "application/zip"): Blob {
	const clean = base64.replace(/^data:.*?;base64,/, "").trim();
	const byteCharacters = atob(clean);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	const byteArray = new Uint8Array(byteNumbers);
	return new Blob([byteArray], { type: mimeType });
}

export async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const res = reader.result as string;
			resolve(res);
		};
		reader.onerror = (err) => reject(err);
		reader.readAsDataURL(file);
	});
}

export async function extractManifestFromZip(
	fileOrBase64: File | string,
): Promise<BackupArchiveManifest | null> {
	try {
		let buffer: ArrayBuffer | Blob;
		if (typeof fileOrBase64 === "string") {
			buffer = base64ToBlob(fileOrBase64);
		} else {
			buffer = fileOrBase64;
		}

		const zip = await JSZip.loadAsync(buffer);
		const manifestFile = zip.file("manifest.json");
		if (!manifestFile) return null;

		const text = await manifestFile.async("string");
		return JSON.parse(text) as BackupArchiveManifest;
	} catch {
		return null;
	}
}

export async function triggerDownloadArchive(
	base64Data: string,
	fileName: string,
): Promise<{ saved: boolean; path?: string }> {
	const electron = (
		window as unknown as {
			electronAPI?: {
				saveBackupFile?: (
					defaultName: string,
					data: string,
				) => Promise<{
					success: boolean;
					filePath?: string;
					canceled: boolean;
				}>;
			};
		}
	).electronAPI;

	// Use native desktop save dialog if available in Electron
	if (electron?.saveBackupFile) {
		const result = await electron.saveBackupFile(fileName, base64Data);
		if (result.canceled) return { saved: false };
		return { saved: result.success, path: result.filePath };
	}

	// Browser fallback
	const blob = base64ToBlob(base64Data, "application/zip");
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);

	return { saved: true };
}
