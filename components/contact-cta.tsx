"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { RevealOnScroll } from "@/components/reveal-on-scroll";

export function ContactCta() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section id="contact" className="border-y border-black/10 bg-[#ededec] text-[#090912]">
      <RevealOnScroll className="mx-auto max-w-7xl px-5 py-14 text-center sm:px-8 lg:px-10">
        <h2 className="mx-auto max-w-5xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
          Ready to preflight your next prompt?
        </h2>
        <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-[#72717d] sm:text-lg">
          Try PromptGuard with your workflow, review pricing, or connect directly for deployment guidance.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setOpen(true);
            }}
            className="inline-flex h-12 min-w-40 items-center justify-center rounded-lg bg-[#080810] px-6 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-black hover:shadow-md active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#080810]"
          >
            Book a demo
          </button>
          <a
            href="mailto:sales@promptguard.ai"
            className="pg-button-arrow inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-lg border border-black/12 bg-white px-6 text-sm font-semibold text-[#080810] shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-[#fbfbfa] hover:shadow-md active:translate-y-0"
          >
            Contact sales
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <p className="mt-7 text-sm font-medium text-[#72717d]">
          Or email us directly at{" "}
          <a href="mailto:hello@promptguard.ai" className="text-[#090912] transition hover:text-black">
            hello@promptguard.ai
          </a>
        </p>
      </RevealOnScroll>

      {open ? (
        <div
          className="pg-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-md"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-form-title"
            className="pg-modal-panel max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-black/10 bg-white text-[#090912] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-5 border-b border-black/10 px-6 py-5 sm:px-8">
              <div>
                <h3 id="demo-form-title" className="text-2xl font-semibold tracking-[-0.01em]">
                  Book a demo
                </h3>
                <p className="mt-1 text-base leading-6 text-[#72717d]">
                  Tell us about your prompt workflow and we will be in touch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close demo form"
                className="rounded-md p-2 text-[#72717d] transition hover:bg-black/[0.04] hover:text-[#090912]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitted ? (
              <div className="px-6 py-8 text-center sm:px-8">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#080810] text-white">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="mt-5 text-2xl font-semibold">Request received.</h4>
                <p className="mx-auto mt-3 max-w-md text-base leading-7 text-[#72717d]">
                  Thanks for reaching out. This demo form is wired for the landing experience; for a real booking, email
                  hello@promptguard.ai.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-7 inline-flex h-11 items-center justify-center rounded-lg bg-[#080810] px-6 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6 sm:px-8">
                <label className="block">
                  <span className="text-sm font-semibold text-[#3f414b]">Full name *</span>
                  <input
                    required
                    name="name"
                    placeholder="Jane Smith"
                    className="mt-2 h-12 w-full rounded-lg border border-black/15 bg-white px-4 text-base text-[#090912] outline-none transition placeholder:text-[#9b9ca6] hover:border-black/25 focus:border-[#080810] focus:ring-4 focus:ring-black/5"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#3f414b]">Company / organization *</span>
                  <input
                    required
                    name="company"
                    placeholder="Acme AI Lab"
                    className="mt-2 h-12 w-full rounded-lg border border-black/15 bg-white px-4 text-base text-[#090912] outline-none transition placeholder:text-[#9b9ca6] hover:border-black/25 focus:border-[#080810] focus:ring-4 focus:ring-black/5"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#3f414b]">Work email *</span>
                  <input
                    required
                    type="email"
                    name="email"
                    placeholder="jane@company.com"
                    className="mt-2 h-12 w-full rounded-lg border border-black/15 bg-white px-4 text-base text-[#090912] outline-none transition placeholder:text-[#9b9ca6] hover:border-black/25 focus:border-[#080810] focus:ring-4 focus:ring-black/5"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#3f414b]">Job role *</span>
                  <select
                    required
                    name="role"
                    defaultValue=""
                    className="mt-2 h-12 w-full rounded-lg border border-black/15 bg-white px-4 text-base text-[#090912] outline-none transition hover:border-black/25 focus:border-[#080810] focus:ring-4 focus:ring-black/5"
                  >
                    <option value="" disabled>
                      Select your role...
                    </option>
                    <option>Founder / builder</option>
                    <option>Product manager</option>
                    <option>Engineer</option>
                    <option>Designer</option>
                    <option>Security / compliance</option>
                    <option>Other</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-[#3f414b]">Tell us about your needs</span>
                  <textarea
                    name="needs"
                    placeholder="Describe the prompts, workflows, or review process you want to improve..."
                    className="mt-2 min-h-28 w-full resize-none rounded-lg border border-black/15 bg-white px-4 py-3 text-base leading-7 text-[#090912] outline-none transition placeholder:text-[#9b9ca6] hover:border-black/25 focus:border-[#080810] focus:ring-4 focus:ring-black/5"
                  />
                </label>

                <button
                  type="submit"
                  className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#080810] px-6 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-black hover:shadow-md active:translate-y-0"
                >
                  Submit request
                </button>

                <p className="text-center text-sm font-medium text-[#9b9ca6]">
                  We will respond within one business day. No spam.
                </p>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
