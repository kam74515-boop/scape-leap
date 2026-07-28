/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import Script from "next/script";
import { Links, Meta, Outlet, Scripts } from "react-router";
import type { LinksFunction } from "react-router";
import { ThemeProvider, useTheme } from "next-themes";
// plane imports
import { SITE_DESCRIPTION } from "@plane/constants";
import { cn } from "@plane/utils";
// types
// assets
import favicon16 from "@/app/assets/favicon/favicon-16x16.png?url";
import favicon32 from "@/app/assets/favicon/favicon-32x32.png?url";
import faviconIco from "@/app/assets/favicon/favicon.ico?url";
import icon180 from "@/app/assets/icons/icon-180x180.png?url";
import icon512 from "@/app/assets/icons/icon-512x512.png?url";
import ogImage from "@/app/assets/og-image.png?url";
import globalStyles from "@/styles/globals.css?url";
import type { Route } from "./+types/root";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// local
import { CustomErrorComponent } from "./error";
import { AppProvider } from "./provider";
// fonts
import "@fontsource-variable/inter";
import interVariableWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import "@fontsource/material-symbols-rounded";
import "@fontsource/ibm-plex-mono";

const APP_TITLE = "构境AI";
const APP_BASE_URL = (process.env.VITE_WEB_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

export const links: LinksFunction = () => [
  { rel: "icon", type: "image/png", sizes: "32x32", href: favicon32 },
  { rel: "icon", type: "image/png", sizes: "16x16", href: favicon16 },
  { rel: "shortcut icon", href: faviconIco },
  { rel: "manifest", href: "/site.webmanifest.json" },
  { rel: "apple-touch-icon", href: icon512 },
  { rel: "apple-touch-icon", sizes: "180x180", href: icon180 },
  { rel: "apple-touch-icon", sizes: "512x512", href: icon512 },
  { rel: "manifest", href: "/manifest.json" },
  { rel: "stylesheet", href: globalStyles },
  {
    rel: "preload",
    href: interVariableWoff2,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const isSessionRecorderEnabled = parseInt(process.env.VITE_ENABLE_SESSION_RECORDER || "0");

  return (
    <html lang="en" className="h-full overflow-hidden" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#fff" />
        {/* Meta info for PWA */}
        <meta name="application-name" content="构境AI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="构境AI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <Meta />
        <Links />
        {/* 全局锁视口：禁止 document 级上下滑动，滚动只发生在壳内面板 */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                height: 100%;
                max-height: 100dvh;
                overflow: hidden !important;
                overscroll-behavior: none;
              }
              body {
                position: fixed;
                inset: 0;
                width: 100%;
                margin: 0;
              }
              .desktop-app-container {
                height: 100%;
                max-height: 100dvh;
                overflow: hidden;
              }
            `,
          }}
        />
      </head>
      <body className="h-full overflow-hidden overscroll-none" suppressHydrationWarning>
        <div id="context-menu-portal" />
        <div id="editor-portal" />
        {/* 构境默认浅色：主区/卡片应为纯白 surface；system 夜间会进 dark 导致「不是白色」 */}
        <ThemeProvider themes={["light", "dark", "light-contrast", "dark-contrast", "custom"]} defaultTheme="light">
          {children}
        </ThemeProvider>
        <Scripts />
        {!!isSessionRecorderEnabled && process.env.VITE_SESSION_RECORDER_KEY && (
          <Script id="clarity-tracking">
            {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];if(y){y.parentNode.insertBefore(t,y);}
          })(window, document, "clarity", "script", "${process.env.VITE_SESSION_RECORDER_KEY}");`}
          </Script>
        )}
      </body>
    </html>
  );
}

export const meta: Route.MetaFunction = () => [
  { title: APP_TITLE },
  { name: "description", content: SITE_DESCRIPTION },
  { property: "og:title", content: APP_TITLE },
  { property: "og:description", content: SITE_DESCRIPTION },
  { property: "og:url", content: `${APP_BASE_URL}/` },
  { property: "og:image", content: `${APP_BASE_URL}${ogImage}` },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { property: "og:image:alt", content: "构境AI / formscape" },
  {
    name: "keywords",
    content: "构境AI, formscape, 造境跃迁, 设计师ERP, 设计工作室, 意向画布, 室内设计",
  },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: `${APP_BASE_URL}${ogImage}` },
  { name: "twitter:image:width", content: "1200" },
  { name: "twitter:image:height", content: "630" },
  { name: "twitter:image:alt", content: "构境AI / formscape" },
];

export default function Root() {
  return (
    <AppProvider>
      <div
        className={cn(
          "relative flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-canvas",
          "desktop-app-container"
        )}
      >
        <main className="relative min-h-0 h-full w-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    </AppProvider>
  );
}

export function HydrateFallback() {
  // 服务端与客户端首帧必须一致（resolvedTheme 在服务端恒 undefined，
  // 依赖它会触发 hydration mismatch），故渲染与主题无关的固定结构。
  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-canvas">
      <LogoSpinner />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <CustomErrorComponent error={error} />;
}
