/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

const CAPABILITIES = ["AI 设计协同", "项目全流程", "客户交付 Portal"];

export function AuthFooter() {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-12 text-tertiary">为室内设计工作室打造的 Studio OS</span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {CAPABILITIES.map((capability) => (
          <span
            key={capability}
            className="rounded-full border border-subtle bg-surface-1 px-3 py-1 text-11 text-secondary"
          >
            {capability}
          </span>
        ))}
      </div>
    </div>
  );
}
