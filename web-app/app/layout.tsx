import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "DayPulse — Daily Routines, Tasks & Financial Ledger",
	description:
		"Keep track of daily activities, routines, scheduled events, and cumulative spendings and earnings across devices.",
	manifest: "/manifest.json",
	icons: {
		icon: [{ url: "/icon.png", type: "image/png" }, { url: "/favicon.ico" }],
		apple: [{ url: "/apple-icon.png", type: "image/png" }],
	},
};

export const viewport: Viewport = {
	themeColor: "#090d16",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full dark antialiased`}
		>
			<body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300">
				<AuthProvider>
					<NotificationProvider>
						<ConfirmProvider>
							{children}
							<Toaster
								theme="dark"
								position="top-right"
								richColors
								closeButton
								toastOptions={{
									className:
										"rounded-xl border border-slate-800 bg-slate-900 text-slate-100",
								}}
							/>
						</ConfirmProvider>
					</NotificationProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
