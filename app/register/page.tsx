"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Activity, ArrowRight, Lock, Mail, User, DollarSign } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/currency-symbols";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  currency: z.string().min(1),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser, user, loading } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", currency: "USD" },
  });

  React.useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const onSubmit = async (data: RegisterFormValues) => {
    await registerUser(data.name, data.email, data.password, data.currency);
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
            Create your account
          </h1>
          <p className="text-xs text-slate-400">
            Start managing routines, scheduling tasks, and tracking daily cashflow
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <Input
                  id="name"
                  placeholder="Pallab Sarker"
                  className="pl-9"
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name.message}</p>
              )}
            </div>

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
                  placeholder="At least 6 characters"
                  className="pl-9"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currency">Preferred Currency</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <select
                  id="currency"
                  {...register("currency")}
                  className="flex h-10 w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              type="submit"
              variant="emerald"
              disabled={isSubmitting}
              className="w-full gap-2 mt-2 h-11"
            >
              <span>{isSubmitting ? "Creating account..." : "Get Started"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-400 font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
