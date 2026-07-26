import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="mb-2 text-2xl font-bold">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        Slack Lite MVP — secure sessions via Supabase Auth.
      </p>
      <form action={action} className="space-y-3">
        {mode === "signup" ? (
          <>
            <input
              className="flex h-10 w-full rounded-md border px-3 text-sm"
              name="username"
              placeholder="Username"
              required
            />
            <input
              className="flex h-10 w-full rounded-md border px-3 text-sm"
              name="displayName"
              placeholder="Display name"
            />
          </>
        ) : null}
        <input
          className="flex h-10 w-full rounded-md border px-3 text-sm"
          name="email"
          type="email"
          placeholder="Email"
          required
        />
        <input
          className="flex h-10 w-full rounded-md border px-3 text-sm"
          name="password"
          type="password"
          placeholder="Password"
          required
        />
        <Button type="submit" className="w-full">
          {mode === "login" ? "Sign in" : "Sign up"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-zinc-500">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
