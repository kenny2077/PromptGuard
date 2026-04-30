"use client";

import { ScanLine, ShieldCheck, Wand2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

const navItems = [
  {
    href: "/scanner",
    label: "Prompt Detector",
    description: "Score prompts before sending them.",
    icon: ScanLine,
  },
  {
    href: "/rewrite",
    label: "Prompt Rewrite",
    description: "Rewrite rough prompts into safer ones.",
    icon: Wand2,
  },
] as const;

export function PromptGuardWorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f2f2ef] text-slate-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b border-black/10 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-[272px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col px-5 py-6">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="PromptGuard overview">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-[#fafaf8] text-slate-950 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-[1.2rem] font-semibold tracking-tight text-slate-950">PromptGuard</span>
                <span className="block text-sm text-slate-500">Minimal prompt workspace</span>
              </span>
            </Link>

            <div className="mt-8">
              <div className="mb-3 px-1 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-slate-400">
                Core tools
              </div>
              <nav className="space-y-2">
                {navItems.map(({ href, label, description, icon: Icon }) => {
                  const active = pathname === href;

                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-start gap-3 rounded-[22px] border px-4 py-4 transition",
                        active
                          ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                          : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-[#f7f7f5] hover:text-slate-950",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                          active
                            ? "border-white/15 bg-white/10 text-white"
                            : "border-slate-200 bg-white text-slate-700",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className={cn("mt-1 block text-sm leading-6", active ? "text-white/70" : "text-slate-500")}>
                          {description}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
