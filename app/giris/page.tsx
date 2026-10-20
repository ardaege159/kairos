import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

async function LoginFormWithParams({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  const { hata } = await searchParams;
  return <LoginForm linkError={hata === "baglanti"} />;
}

export default function GirisPage({ searchParams }: PageProps<"/giris">) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <section className="glass-card w-full max-w-sm p-8">
        <p className="text-primary text-3xl font-bold tracking-tight ">
          Kairos
        </p>
        <h1 className="mt-6 text-lg font-semibold">Giriş yap</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">
          E-posta ve şifrenle gir. Şifren yoksa e-postana tek kullanımlık giriş bağlantısı gönderebiliriz.
        </p>
        <Suspense fallback={<LoginForm />}>
          <LoginFormWithParams searchParams={searchParams as Promise<{ hata?: string }>} />
        </Suspense>
      </section>
    </main>
  );
}
