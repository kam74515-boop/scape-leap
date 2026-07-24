/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Script from "next/script";

// styles
import "@/styles/globals.css";

import { SITE_DESCRIPTION } from "@plane/constants";

// helpers
import { cn } from "@plane/utils";

// assets
import favicon16 from "@/app/assets/favicon/favicon-16x16.png?url";
import favicon32 from "@/app/assets/favicon/favicon-32x32.png?url";
import faviconIco from "@/app/assets/favicon/favicon.ico?url";
import icon180 from "@/app/assets/icons/icon-180x180.png?url";
import icon512 from "@/app/assets/icons/icon-512x512.png?url";

// local
import { AppProvider } from "./provider";

export const meta = () => [
  { title: "构境AI" },
  { name: "description", content: SITE_DESCRIPTION },
  {
    name: "keywords",
    content: "构境AI, formscape, 造境跃迁, 设计师ERP, 设计工作室, 意向画布, 室内设计",
  },
  {
    name: "viewport",
    content:
      "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
  },
  { property: "og:title", content: "构境AI" },
  { property: "og:description", content: SITE_DESCRIPTION },
  { property: "og:url", content: "http://127.0.0.1:3000/" },
  { property: "og:image", content: "/formscape-logos/pwa-512.png" },
  { property: "og:image:width", content: "512" },
  { property: "og:image:height", content: "512" },
  { property: "og:image:alt", content: "构境AI / formscape" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: "/formscape-logos/pwa-512.png" },
  { name: "twitter:image:width", content: "512" },
  { name: "twitter:image:height", content: "512" },
  { name: "twitter:image:alt", content: "构境AI / formscape" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isSessionRecorderEnabled = parseInt(process.env.VITE_ENABLE_SESSION_RECORDER || "0");

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#fff" />
        <link rel="icon" type="image/png" sizes="32x32" href={favicon32} />
        <link rel="icon" type="image/png" sizes="16x16" href={favicon16} />
        <link rel="manifest" href="/site.webmanifest.json" />
        <link rel="shortcut icon" href={faviconIco} />
        {/* Meta info for PWA */}
        <meta name="application-name" content="构境AI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="构境AI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href={icon512} />
        <link rel="apple-touch-icon" sizes="180x180" href={icon180} />
        <link rel="apple-touch-icon" sizes="512x512" href={icon512} />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <div id="context-menu-portal" />
        <div id="editor-portal" />
        <AppProvider>
          <div className={cn("relative flex h-screen w-full flex-col overflow-hidden", "app-container")}>
            <main className="relative h-full w-full overflow-hidden">{children}</main>
          </div>
        </AppProvider>
      </body>
      {!!isSessionRecorderEnabled && process.env.VITE_SESSION_RECORDER_KEY && (
        <Script id="clarity-tracking">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];if(y){y.parentNode.insertBefore(t,y);}
          })(window, document, "clarity", "script", "${process.env.VITE_SESSION_RECORDER_KEY}");`}
        </Script>
      )}
    </html>
  );
}
