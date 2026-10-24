import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DesktopTitlebar } from "@/components/layout/desktop-titlebar";
import { AuthProvider } from "@/components/providers/auth-provider";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
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
	verification: {
		google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
	},
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
		{ media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
	],
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
	interactiveWidget: "resizes-content",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<head>
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Inline theme script prevents initial paint flash
					dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
				/>
			</head>
			<body className="min-h-full flex flex-col bg-background text-foreground selection:bg-primary/25 selection:text-foreground">
				<ThemeProvider>
					<DesktopTitlebar />
					<AuthProvider>
						<NotificationProvider>
							<ConfirmProvider>{children}</ConfirmProvider>
						</NotificationProvider>
					</AuthProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
