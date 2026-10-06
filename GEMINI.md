# GEMINI.md — Development Guidelines & Coding Rules

> **Developer:** Pallab Kumar Sarker  
> **Role:** Full-Stack TypeScript Engineer  
> **Scope:** Automatically loaded by Antigravity in all workspaces and subdirectories.

---

## 1. Zero AI Noise & Anti-Patterns (STRICT MANDATE)

When generating, modifying, or reviewing code:
1. **NO Emojis in Code:** NEVER include decorative emojis (🚀, 💡, ✨, 🔥, 📝, ⚠️, etc.) in code comments, JSDoc, commit messages, or terminal logs. Code must remain clean, professional, and terse. (Emojis are only allowed in customer-facing UI text if explicitly requested).
2. **NO Multiline `/** ... */` AI Comments:** NEVER write artificial JSDoc blocks (`/** ... */`), verbose multi-line docstrings, or repetitive `@param` / `@returns` headers that reek of AI generation. If a comment is strictly necessary, use a concise, smart single-line `//` comment explaining non-obvious business logic or technical edge cases. Prefer self-documenting code over commenting.
3. **NO Redundant / Fluff Comments:** NEVER write comments that merely rephrase what the code is doing (e.g., `// Set name to string`, `// Handle form submit`, `// Return response`).
4. **NO Half-Baked Placeholders:** NEVER output `// TODO: add logic later` or `// ... rest of code`. Always provide complete, syntactically valid, production-ready code.
5. **NO Outdated Practices:**
   - Always use ES Modules (`import` / `export`), never CommonJS `require()` / `module.exports`.
   - Always use TypeScript `interface` or `type`, never `PropTypes`.
   - Never use loose/untyped `any`. If a temporary `any` is unavoidable, suppress via Biome ignore comment: `/** biome-ignore lint/suspicious/noExplicitAny: <> */`.
   - Never use raw CSS or inline hex colors when Tailwind utility classes exist.
   - Never use `alert()` or raw browser popups; always use **Sonner** (`toast.success()`, `toast.error()`) or Radix/Shadcn dialogs.
6. **Tooling Respect (Biome):** The developer uses **Biome** (`@biomejs/biome`) for linting and formatting. Do NOT create ESLint or Prettier configs in projects using Biome (`biome check`, `biome format --write`).

---

## 2. File Organization, Modularity & Architecture Standards

Always keep the codebase clean, readable, and highly maintainable:
1. **Always Keep Code Clean & Split Big Files:** If a file or component grows large or handles multiple concerns, split it into smaller, modular files. Avoid monolithic multi-hundred-line files.
2. **Folder Grouping with Index:** When a feature, component, or module has multiple related files, sub-components, or hooks, group them into a dedicated folder with an `index.ts` / `index.tsx` entrypoint for clean imports.
3. **Reusable Code Over Repetition (DRY):** Whenever a piece of logic, UI snippet, calculation, or procedure is needed again and again (or at least a few times), extract it into a reusable function, component, or custom hook. Never duplicate code.
4. **Max 50 Lines Inside `if/else` Blocks:** NEVER write more than 50 lines of code inside an `if` or `else` branch—it degrades readability and makes flow difficult to trace. Extract the branch logic into a separate, clearly-named function. If large/complex, place it in a dedicated file (in kebab-case); if small, define it as a helper function in the same file and call it inside the branch. Prefer early returns / guard clauses.
5. **Utils in Kebab-Case:** Name utility/helper files strictly in **kebab-case** (e.g., `image-compression.ts`, `pdf-utils.ts`, `video-processor.ts`, `verify-token.ts`, `date-helpers.ts`).
6. **Dedicated File for Large Functions:** NEVER dump large, complex, or heavy functions into a generic utility file. Always create a **separate, dedicated file** for each distinct large function/utility (e.g., `frame-worker.ts`, `image-compression.ts`, `pdf-generator.ts`).
7. **Single File for Small Helpers:** Consolidate small, generic utility/helper functions together in a single shared file (e.g., `utils.ts`, `helpers.ts`).

---

## 3. Modern Tech Stack (2025–2026 Standards)

- **Frontend / Fullstack:** Next.js (App Router, Server Actions, Route Handlers), React 19, TypeScript 5+
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`, `tw-animate-css`), `shadcn/ui`, Radix UI primitives, `clsx`, `tailwind-merge` (`cn()` helper)
- **Icons:** `lucide-react` (primary), `react-icons` (when specific brand/utility icons are required)
- **Animation:** `framer-motion`, `gsap` (`@gsap/react`)
- **Forms & Validation:** `react-hook-form` + `@hookform/resolvers/zod` + `zod`
- **Notifications:** `sonner` (`toast.success()`, `toast.error()`)
- **Backend Architecture:** Express.js (TypeScript) or Next.js API Routes using Modular Clean Architecture (`modules/<feature>/` containing `.controller.ts`, `.service.ts`, `.route.ts`, `.validation.ts`, `.model.ts`, `.interface.ts`)
- **Database & ORM:** **Prisma** (PostgreSQL/relational) and **Mongoose** (MongoDB with `QueryBuilder`)
- **Error Handling & Response:** Custom `AppError` class (extending `Error` with `statusCode`), `catchAsync` wrapper, `sendResponse` helper with `{ statusCode, success, message, data, meta }`, centralized error middleware with `http-status`
- **Auth & Security:** JWT tokens (`jsonwebtoken`, `jwt-decode`), HTTP-only secure cookies (`next/headers`), role-based middleware (`auth(Role.ADMIN)`)
- **Cross-Platform:** Electron (Desktop), Capacitor (Mobile)

---

## 4. Standard Code Patterns

### Frontend Form Pattern (React Hook Form + Zod + Sonner + Shadcn)
```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

type FormValues = z.infer<typeof formSchema>;

export function ExampleForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await submitAction(data);
      if (res.success) {
        toast.success(res.message || "Saved successfully");
        reset();
      } else {
        toast.error(res.message || "Failed to save");
      }
    } catch {
      toast.error("An unexpected error occurred");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Submit"}
      </Button>
    </form>
  );
}
```

### Backend Error & Response Pattern
```ts
// AppError.ts
export class AppError extends Error {
  public statusCode: number;
  constructor(statusCode: number, message: string, stack = "") {
    super(message);
    this.statusCode = statusCode;
    if (stack) this.stack = stack;
    else Error.captureStackTrace(this, this.constructor);
  }
}

// sendResponse.ts
export const sendResponse = <T>(res: Response, data: {
  statusCode: number;
  success: boolean;
  message?: string;
  data: T | null;
  meta?: { page: number; limit: number; totalData: number; totalPage: number } | null;
}): void => {
  res.status(data.statusCode).json({
    statusCode: data.statusCode,
    success: data.success,
    message: data.message,
    data: data.data ?? null,
    meta: data.meta ?? null,
  });
};
```

---

*For detailed architectural specifications, full templates, and chronological history, refer to `AI_CODING_INSTRUCTIONS.md`.*
