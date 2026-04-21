import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/lib/convex";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/ThemeToggle";
import { NotFound } from "@/components/ui/NotFound";
import appCss from "../app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "lawn — video review for creative teams" },
      {
        name: "description",
        content:
          "Video review and collaboration for creative teams. Frame-accurate comments, unlimited seats, $5/month flat. The open source Frame.io alternative.",
      },
      { property: "og:site_name", content: "lawn" },
      { name: "twitter:site", content: "@theo" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/grass-logo.svg?v=4" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico?v=4" },
      { rel: "shortcut icon", href: "/favicon.ico?v=4" },
      { rel: "preconnect", href: "https://stream.mux.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://image.mux.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "//stream.mux.com" },
      { rel: "dns-prefetch", href: "//image.mux.com" },
    ],
  }),
  component: RootComponent,
  errorComponent: ({ error }) => {
    return (
      <main className="pt-16 p-4 container mx-auto">
        <h1>Error</h1>
        <p>{error instanceof Error ? error.message : "An unexpected error occurred."}</p>
        {import.meta.env.DEV && error instanceof Error && error.stack ? (
          <pre className="w-full p-4 overflow-x-auto">
            <code>{error.stack}</code>
          </pre>
        ) : null}
      </main>
    );
  },
  notFoundComponent: () => <NotFound />,
});

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0f0e8] p-8 text-[#1a1a1a] font-sans">
        <div className="max-w-md w-full border-2 border-[#1a1a1a] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]">
          <h1 className="text-2xl font-black uppercase tracking-tight mb-4">Setup Required</h1>
          <p className="mb-6 leading-relaxed">
            Missing <code className="bg-gray-100 px-1 font-mono text-sm">VITE_CLERK_PUBLISHABLE_KEY</code>.
          </p>
          <p className="mb-6 text-sm text-[#888888]">
            Please add your Clerk publishable key to <code className="bg-gray-100 px-1 font-mono text-xs">.env.local</code> to continue.
          </p>
          <div className="border-t-2 border-[#1a1a1a] pt-6">
            <a 
              href="https://dashboard.clerk.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block bg-[#2d5a2d] text-[#f0f0e8] px-6 py-3 font-bold uppercase tracking-wide hover:bg-[#3a6a3a] transition-colors"
            >
              Get Clerk Key
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <RootDocument>{children}</RootDocument>
    </ClerkProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const themeInitScript = `
    (() => {
      try {
        const stored = localStorage.getItem("lawn-theme");
        if (stored === "light" || stored === "dark") {
          document.documentElement.setAttribute("data-theme", stored);
          return;
        }
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
          document.documentElement.setAttribute("data-theme", "dark");
        }
      } catch {}
    })();
  `;

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="h-full antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ConvexClientProvider>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </ConvexClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
