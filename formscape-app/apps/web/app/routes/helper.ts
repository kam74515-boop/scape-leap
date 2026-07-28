/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { RouteConfigEntry } from "@react-router/dev/routes";

/**
 * Merges two route configurations intelligently.
 * - Deep merges children when the same layout file exists in both arrays
 * - Deduplicates routes by file+path composite key, preferring extended over core
 * - Maintains order: core routes first, then extended routes at each level
 *
 * 注意：去重键必须包含 path。仅按 file 去重会把「同文件别名路由」互相覆盖
 * （如 :workspaceSlug/users 与 :workspaceSlug/team 同指向 users/page.tsx，
 * 后者会顶掉前者，导致 /users 404——2026-07-27 实际事故）。
 */
function routeKey(r: RouteConfigEntry): string {
  return `${r.file}::${r.path ?? ""}`;
}

export function mergeRoutes(core: RouteConfigEntry[], extended: RouteConfigEntry[]): RouteConfigEntry[] {
  // Step 1: Create a Map to track routes by file+path key
  const routeMap = new Map<string, RouteConfigEntry>();

  // Step 2: Process core routes first
  for (const coreRoute of core) {
    routeMap.set(routeKey(coreRoute), coreRoute);
  }

  // Step 3: Process extended routes
  for (const extendedRoute of extended) {
    const key = routeKey(extendedRoute);

    if (routeMap.has(key)) {
      // Route exists in both - need to merge
      const coreRoute = routeMap.get(key)!;

      // Check if both have children (layouts that need deep merging)
      if (coreRoute.children && extendedRoute.children) {
        // Deep merge: recursively merge children
        const mergedChildren = mergeRoutes(
          Array.isArray(coreRoute.children) ? coreRoute.children : [],
          Array.isArray(extendedRoute.children) ? extendedRoute.children : []
        );
        routeMap.set(key, {
          ...extendedRoute,
          children: mergedChildren,
        });
      } else {
        // No children or only one has children - prefer extended
        routeMap.set(key, extendedRoute);
      }
    } else {
      // Route only exists in extended
      routeMap.set(key, extendedRoute);
    }
  }

  // Step 4: Build final array maintaining order (core first, then extended-only)
  const result: RouteConfigEntry[] = [];

  // Add all core routes (now merged or original)
  for (const coreRoute of core) {
    const key = routeKey(coreRoute);
    if (routeMap.has(key)) {
      result.push(routeMap.get(key)!);
      routeMap.delete(key); // Remove so we don't add it again
    }
  }

  // Add remaining extended-only routes
  for (const extendedRoute of extended) {
    const key = routeKey(extendedRoute);
    if (routeMap.has(key)) {
      result.push(routeMap.get(key)!);
      routeMap.delete(key);
    }
  }

  return result;
}
