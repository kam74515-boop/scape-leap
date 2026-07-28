import { describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeEmail,
  publicUser,
  validateEmail,
  validatePassword,
  verifyPassword,
} from "../../../../../../scripts/auth.mjs";

describe("production authentication primitives", () => {
  it("normalizes and validates email addresses", () => {
    expect(normalizeEmail("  Admin@MuseArt.Cloud ")).toBe("admin@museart.cloud");
    expect(validateEmail("admin@museart.cloud")).toBe(true);
    expect(validateEmail("not-an-email")).toBe(false);
  });

  it("requires at least 8 characters and all password classes", () => {
    expect(validatePassword("Aa1!aaa")).toBe(false);
    expect(validatePassword("Aa1!aaaa")).toBe(true);
    expect(validatePassword("onlylowercasepassword")).toBe(false);
    expect(validatePassword("StrongPassword!9")).toBe(true);
  });

  it("hashes passwords with a unique scrypt salt and verifies in constant-shape comparisons", async () => {
    const first = await hashPassword("StrongPassword!9");
    const second = await hashPassword("StrongPassword!9");

    expect(first).toMatch(/^scrypt\$/);
    expect(second).not.toBe(first);
    expect(await verifyPassword("StrongPassword!9", first)).toBe(true);
    expect(await verifyPassword("WrongPassword!9", first)).toBe(false);
  });

  it("never exposes password or session fields in the public user payload", () => {
    const user = publicUser({
      id: "94f5c2c9-c509-4f86-889d-cb631c2db739",
      email: "admin@museart.cloud",
      password_hash: "secret",
      token_hash: "secret",
      display_name: "构境管理员",
      first_name: "管理员",
      last_name: "",
      role: "owner",
      is_active: true,
      is_email_verified: true,
      must_change_password: true,
      created_at: new Date("2026-07-28T00:00:00.000Z"),
    });

    expect(user.email).toBe("admin@museart.cloud");
    expect(user.is_password_autoset).toBe(true);
    expect(user).not.toHaveProperty("password_hash");
    expect(user).not.toHaveProperty("token_hash");
  });
});
