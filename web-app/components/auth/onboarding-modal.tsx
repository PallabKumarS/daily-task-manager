"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	Activity,
	ArrowLeft,
	ArrowRight,
	Cloud,
	FileArchive,
	Lock,
	LogIn,
	Mail,
	Server,
	Sparkles,
	User,
	UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { GoogleRestoreModal } from "@/components/auth/google-restore-modal";
import { RestoreBackupModal } from "@/components/auth/restore-backup-modal";
import { ServerConfigModal } from "@/components/auth/server-config-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { CustomSelect, type SelectOption } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiBaseUrl, isCustomServerSet } from "@/lib/api-client";
import { CURRENCIES } from "@/lib/currency-symbols";

const CURRENCY_SELECT_OPTIONS: SelectOption[] = CURRENCIES.map((c) => ({
	label: `${c.name} (${c.code})`,
	value: c.code,
	badge: c.symbol,
}));

const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Invalid email address"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	currency: z.string().min(1),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

type OnboardingView = "CHOICE" | "LOGIN" | "REGISTER";

interface OnboardingModalProps {
	isOpen: boolean;
	initialView?: OnboardingView;
}

export function OnboardingModal({ isOpen, initialView = "CHOICE" }: OnboardingModalProps) {
	const router = useRouter();
	const { login, register: registerUser, user } = useAuth();

	const [activeView, setActiveView] = React.useState<OnboardingView>(initialView);
	const [isRestoreModalOpen, setIsRestoreModalOpen] = React.useState(false);
	const [isGoogleModalOpen, setIsGoogleModalOpen] = React.useState(false);
	const [isServerModalOpen, setIsServerModalOpen] = React.useState(false);
	const [serverBadge, setServerBadge] = React.useState("Default");

	const updateServerBadge = React.useCallback(() => {
		if (typeof window === "undefined") return;
		if (isCustomServerSet()) {
			const url = getApiBaseUrl().replace(/^https?:\/\//, "");
			setServerBadge(url.length > 24 ? `${url.slice(0, 22)}...` : url);
		} else {
			setServerBadge("Default (:49275 / :5000)");
		}
	}, []);

	React.useEffect(() => {
		updateServerBadge();
	}, [updateServerBadge]);

	const loginForm = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "", password: "" },
	});

	const registerForm = useForm<RegisterFormValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: { name: "", email: "", password: "", currency: "USD" },
	});

	const selectedCurrency = registerForm.watch("currency");

	const onLoginSubmit = async (data: LoginFormValues) => {
		const success = await login(data.email, data.password);
		if (success) {
			router.push("/dashboard");
		}
	};

	const onRegisterSubmit = async (data: RegisterFormValues) => {
		const success = await registerUser(data.name, data.email, data.password, data.currency);
		if (success) {
			router.push("/dashboard");
		}
	};

	if (!isOpen || user) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
			<div className="w-full max-w-lg my-auto rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl space-y-6">
				{activeView === "CHOICE" && (
					<div className="space-y-6">
						<div className="text-center space-y-2">
							<div className="inline-flex items-center gap-2.5">
								<div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-400 text-slate-950 shadow-md shadow-teal-500/20">
									<Activity className="w-6 h-6 stroke-[2.5]" />
								</div>
								<span className="text-2xl font-black text-white">DayPulse</span>
							</div>
							<h2 className="text-xl font-bold tracking-tight text-white pt-1">
								Welcome to Your Personal Workspace
							</h2>
							<p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
								Select how you would like to set up or recover your routines, tasks, and wealth
								ledger on this device.
							</p>
						</div>

						<div className="grid grid-cols-1 gap-3">
							<button
								type="button"
								onClick={() => setActiveView("REGISTER")}
								className="group flex items-start gap-4 p-4 rounded-2xl border border-teal-500/30 bg-teal-950/20 hover:bg-teal-950/40 hover:border-teal-500/50 transition-all text-left cursor-pointer shadow-lg shadow-teal-500/5"
							>
								<div className="h-10 w-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
									<UserPlus className="w-5 h-5" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between">
										<p className="text-sm font-semibold text-white group-hover:text-teal-300 transition-colors">
											Create New Account
										</p>
										<Sparkles className="w-3.5 h-3.5 text-teal-400" />
									</div>
									<p className="text-xs text-slate-400 mt-1 leading-relaxed">
										Start a clean workspace with your name, email, and preferred currency.
									</p>
								</div>
							</button>

							<button
								type="button"
								onClick={() => setActiveView("LOGIN")}
								className="group flex items-start gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-slate-700 transition-all text-left cursor-pointer"
							>
								<div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
									<LogIn className="w-5 h-5" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between">
										<p className="text-sm font-semibold text-white group-hover:text-slate-200 transition-colors">
											Sign In to Existing Account
										</p>
										<ArrowRight className="w-3.5 h-3.5 text-slate-400" />
									</div>
									<p className="text-xs text-slate-400 mt-1 leading-relaxed">
										Enter your registered email and password to access your cloud profile.
									</p>
								</div>
							</button>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
								<button
									type="button"
									onClick={() => setIsRestoreModalOpen(true)}
									className="group flex flex-col p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-slate-700 transition-all text-left cursor-pointer"
								>
									<div className="h-9 w-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-2.5 group-hover:scale-105 transition-transform">
										<FileArchive className="w-4 h-4" />
									</div>
									<p className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">
										Restore from File Backup
									</p>
									<p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
										Import .zip or .json archive from device storage
									</p>
								</button>

								<button
									type="button"
									onClick={() => setIsGoogleModalOpen(true)}
									className="group flex flex-col p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-slate-700 transition-all text-left cursor-pointer"
								>
									<div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-2.5 group-hover:scale-105 transition-transform">
										<Cloud className="w-4 h-4" />
									</div>
									<p className="text-xs font-semibold text-white group-hover:text-sky-300 transition-colors">
										Sync with Google Drive
									</p>
									<p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
										Recover encrypted snapshot from cloud storage
									</p>
								</button>
							</div>
						</div>

						<div className="pt-2 flex justify-center">
							<button
								type="button"
								onClick={() => setIsServerModalOpen(true)}
								className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors py-1 px-3 rounded-full border border-slate-800 bg-slate-950/60"
							>
								<Server className="w-3 h-3 text-teal-400" />
								<span>Server: {serverBadge}</span>
							</button>
						</div>
					</div>
				)}

				{activeView === "LOGIN" && (
					<div className="space-y-5">
						<div className="flex items-center justify-between pb-2 border-b border-slate-800">
							<button
								type="button"
								onClick={() => setActiveView("CHOICE")}
								className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
							>
								<ArrowLeft className="w-4 h-4" />
								<span>Back to Options</span>
							</button>
							<span className="text-xs font-semibold text-teal-400">Account Sign In</span>
						</div>

						<div className="space-y-1">
							<h3 className="text-lg font-bold text-white">Sign In to Your Account</h3>
							<p className="text-xs text-slate-400">
								Access your synchronized routines, tasks, and financial ledger.
							</p>
						</div>

						<form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="onboarding-login-email">Email Address</Label>
								<div className="relative">
									<Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
									<Input
										id="onboarding-login-email"
										type="email"
										placeholder="you@example.com"
										className="pl-9"
										{...loginForm.register("email")}
									/>
								</div>
								{loginForm.formState.errors.email && (
									<p className="text-xs text-rose-400">
										{loginForm.formState.errors.email.message}
									</p>
								)}
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="onboarding-login-password">Password</Label>
								<div className="relative">
									<Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
									<Input
										id="onboarding-login-password"
										type="password"
										placeholder="••••••••"
										className="pl-9"
										{...loginForm.register("password")}
									/>
								</div>
								{loginForm.formState.errors.password && (
									<p className="text-xs text-rose-400">
										{loginForm.formState.errors.password.message}
									</p>
								)}
							</div>

							<Button
								type="submit"
								disabled={loginForm.formState.isSubmitting}
								className="w-full gap-2 mt-2 h-11"
							>
								<span>{loginForm.formState.isSubmitting ? "Signing In..." : "Sign In"}</span>
								<ArrowRight className="w-4 h-4" />
							</Button>
						</form>

						<div className="text-center text-xs text-slate-400 pt-1">
							Need a new account?{" "}
							<button
								type="button"
								onClick={() => setActiveView("REGISTER")}
								className="text-teal-400 font-semibold hover:underline cursor-pointer"
							>
								Create Account
							</button>
						</div>
					</div>
				)}

				{activeView === "REGISTER" && (
					<div className="space-y-5">
						<div className="flex items-center justify-between pb-2 border-b border-slate-800">
							<button
								type="button"
								onClick={() => setActiveView("CHOICE")}
								className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
							>
								<ArrowLeft className="w-4 h-4" />
								<span>Back to Options</span>
							</button>
							<span className="text-xs font-semibold text-teal-400">Create Account</span>
						</div>

						<div className="space-y-1">
							<h3 className="text-lg font-bold text-white">Create New Workspace</h3>
							<p className="text-xs text-slate-400">
								Set up your personal DayPulse profile on this device.
							</p>
						</div>

						<form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-3.5">
							<div className="space-y-1.5">
								<Label htmlFor="onboarding-reg-name">Full Name</Label>
								<div className="relative">
									<User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
									<Input
										id="onboarding-reg-name"
										placeholder="Pallab Sarker"
										className="pl-9"
										{...registerForm.register("name")}
									/>
								</div>
								{registerForm.formState.errors.name && (
									<p className="text-xs text-rose-400">
										{registerForm.formState.errors.name.message}
									</p>
								)}
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="onboarding-reg-email">Email Address</Label>
								<div className="relative">
									<Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
									<Input
										id="onboarding-reg-email"
										type="email"
										placeholder="you@example.com"
										className="pl-9"
										{...registerForm.register("email")}
									/>
								</div>
								{registerForm.formState.errors.email && (
									<p className="text-xs text-rose-400">
										{registerForm.formState.errors.email.message}
									</p>
								)}
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="onboarding-reg-password">Password</Label>
								<div className="relative">
									<Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
									<Input
										id="onboarding-reg-password"
										type="password"
										placeholder="At least 6 characters"
										className="pl-9"
										{...registerForm.register("password")}
									/>
								</div>
								{registerForm.formState.errors.password && (
									<p className="text-xs text-rose-400">
										{registerForm.formState.errors.password.message}
									</p>
								)}
							</div>

							<CustomSelect
								label="Preferred Currency"
								value={selectedCurrency}
								onChange={(val) => registerForm.setValue("currency", val, { shouldValidate: true })}
								options={CURRENCY_SELECT_OPTIONS}
								allowManage={false}
							/>

							<Button
								type="submit"
								disabled={registerForm.formState.isSubmitting}
								className="w-full gap-2 mt-2 h-11"
							>
								<span>
									{registerForm.formState.isSubmitting ? "Creating Account..." : "Get Started"}
								</span>
								<ArrowRight className="w-4 h-4" />
							</Button>
						</form>

						<div className="text-center text-xs text-slate-400 pt-1">
							Already have an account?{" "}
							<button
								type="button"
								onClick={() => setActiveView("LOGIN")}
								className="text-teal-400 font-semibold hover:underline cursor-pointer"
							>
								Sign In
							</button>
						</div>
					</div>
				)}
			</div>

			<RestoreBackupModal
				isOpen={isRestoreModalOpen}
				onClose={() => setIsRestoreModalOpen(false)}
			/>

			<GoogleRestoreModal
				isOpen={isGoogleModalOpen}
				onClose={() => setIsGoogleModalOpen(false)}
				onOpenFileRestore={() => {
					setIsGoogleModalOpen(false);
					setIsRestoreModalOpen(true);
				}}
			/>

			<ServerConfigModal
				isOpen={isServerModalOpen}
				onClose={() => setIsServerModalOpen(false)}
				onSaved={updateServerBadge}
			/>
		</div>
	);
}
