"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Activity, ArrowRight, Lock, Mail } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
	const { login, user, loading } = useAuth();
	const router = useRouter();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "", password: "" },
	});

	React.useEffect(() => {
		if (!loading && user) {
			router.push("/dashboard");
		}
	}, [user, loading, router]);

	const onSubmit = async (data: LoginFormValues) => {
		await login(data.email, data.password);
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
			<div className="w-full max-w-md space-y-6">
				<div className="text-center space-y-2">
					<Link href="/" className="inline-flex items-center gap-2.5">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20">
							<Activity className="w-5 h-5 stroke-[2.5]" />
						</div>
						<span className="text-xl font-black text-white">DayPulse</span>
					</Link>
					<h1 className="text-2xl font-bold tracking-tight text-white pt-2">
						Sign in to your account
					</h1>
					<p className="text-xs text-slate-400">
						Access your synchronized routines, tasks, and financial ledger
					</p>
				</div>

				<div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="email">Email Address</Label>
							<div className="relative">
								<Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
								<Input
									id="email"
									type="email"
									placeholder="you@example.com"
									className="pl-9"
									{...register("email")}
								/>
							</div>
							{errors.email && (
								<p className="text-xs text-red-400">{errors.email.message}</p>
							)}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="password">Password</Label>
							<div className="relative">
								<Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
								<Input
									id="password"
									type="password"
									placeholder="••••••••"
									className="pl-9"
									{...register("password")}
								/>
							</div>
							{errors.password && (
								<p className="text-xs text-red-400">
									{errors.password.message}
								</p>
							)}
						</div>

						<Button
							type="submit"
							variant="emerald"
							disabled={isSubmitting}
							className="w-full gap-2 mt-2 h-11"
						>
							<span>{isSubmitting ? "Signing in..." : "Sign In"}</span>
							<ArrowRight className="w-4 h-4" />
						</Button>
					</form>

					<div className="mt-6 text-center text-xs text-slate-400">
						Don&apos;t have an account?{" "}
						<Link
							href="/register"
							className="text-emerald-400 font-semibold hover:underline"
						>
							Create an account
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
