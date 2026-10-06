'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false
    });

    setPending(false);

    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }

    router.push('/admin');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080711] px-4">
      <form onSubmit={handleSubmit} className="brand-panel w-full max-w-md rounded-3xl border border-violet-300/15 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
        <div className="mb-5 flex items-center gap-3">
          <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-2xl text-base font-black text-white">T</span>
          <p className="brand-text text-lg font-bold tracking-wide">ThomaGPT</p>
        </div>
        <h1 className="mb-6 text-3xl font-bold text-white">Admin Login</h1>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-violet-300/15 bg-black/20 px-3 py-2 text-white outline-none ring-0 focus:border-violet-400/60"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-violet-300/15 bg-black/20 px-3 py-2 text-white outline-none ring-0 focus:border-violet-400/60"
              required
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-400">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 font-semibold text-white shadow-[0_8px_28px_rgba(147,51,234,0.24)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700"
        >
          {pending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
