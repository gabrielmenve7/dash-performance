"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("error") === "CredentialsSignin") {
      toast.error("Email ou senha incorretos.");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string).trim();
    const password = formData.get("password") as string;
    const origin = window.location.origin;
    const callbackUrl = `${origin}/`;

    try {
      // Fluxo explícito (mesmo contrato do next-auth/react), evita signIn() que em alguns browsers não redireciona.
      const csrfRes = await fetch(`${origin}/api/auth/csrf`, {
        credentials: "include",
      });
      if (!csrfRes.ok) {
        throw new Error("csrf");
      }
      const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
      const csrfToken = csrfJson.csrfToken;
      if (!csrfToken) {
        throw new Error("csrf");
      }

      const body = new URLSearchParams({
        csrfToken,
        email,
        password,
        callbackUrl,
      });

      const res = await fetch(`${origin}/api/auth/callback/credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Auth-Return-Redirect": "1",
        },
        body,
        credentials: "include",
      });

      const raw = await res.text();
      let data: { url?: string } = {};
      try {
        data = JSON.parse(raw) as { url?: string };
      } catch {
        /* ignore */
      }

      const redirectUrl = data.url;
      if (res.ok && redirectUrl) {
        if (redirectUrl.includes("error=CredentialsSignin")) {
          toast.error("Email ou senha incorretos.");
          return;
        }
        window.location.assign(redirectUrl);
        return;
      }

      toast.error("Email ou senha incorretos.");
    } catch {
      toast.error(
        "Não foi possível conectar ao servidor de login. Confira a rede e /api/health."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Dash Performance</h1>
            <p className="text-sm text-blue-300">Ads Analytics Platform</p>
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">Entrar</CardTitle>
            <CardDescription className="text-slate-400">
              Acesse o dashboard com seu email e senha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <div className="mt-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Credenciais de demonstração:</p>
              <p className="text-xs text-slate-300">
                <strong>Admin:</strong> admin@dash.com / admin123
              </p>
              <p className="text-xs text-slate-300">
                <strong>Cliente:</strong> cliente@demo.com / cliente123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
