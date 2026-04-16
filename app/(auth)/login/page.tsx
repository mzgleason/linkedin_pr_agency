import { signIn } from "@/app/(auth)/actions";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <form action={signIn} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <div className="text-neutral-700">Email</div>
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="block space-y-1 text-sm">
          <div className="text-neutral-700">Password</div>
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Sign in
        </button>
      </form>
      <p className="text-sm text-neutral-600">
        New here?{" "}
        <a className="underline" href="/signup">
          Create an account
        </a>
        .
      </p>
    </div>
  );
}

