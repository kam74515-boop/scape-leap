/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
// icons
import { CircleAlert, XCircle } from "@/icons";
// plane imports
import { Button } from "@plane/propel/button";
import type { IEmailCheckData } from "@plane/types";
import { Input, Spinner } from "@plane/ui";
import { cn, checkEmailValidity } from "@plane/utils";
// helpers
type TAuthEmailForm = {
  defaultEmail: string;
  onSubmit: (data: IEmailCheckData) => Promise<void>;
};

export const AuthEmailForm = observer(function AuthEmailForm(props: TAuthEmailForm) {
  const { onSubmit, defaultEmail } = props;
  // states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const emailError = useMemo(
    () => (email && !checkEmailValidity(email) ? { email: "auth.common.email.errors.invalid" } : undefined),
    [email]
  );

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const payload: IEmailCheckData = {
      email: email,
    };
    await onSubmit(payload);
    setIsSubmitting(false);
  };

  const isButtonDisabled = email.length === 0 || Boolean(emailError?.email) || isSubmitting;

  const [isFocused, setIsFocused] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-13 font-medium text-tertiary">
          邮箱
        </label>
        <div
          className={cn(
            `relative flex items-center rounded-md border bg-surface-1`,
            !isFocused && Boolean(emailError?.email) ? `border-danger-strong` : `border-strong`
          )}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
        >
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@studio.com"
            className={`h-10 w-full border-0 disable-autofill-style placeholder:text-placeholder autofill:bg-danger-primary focus:bg-none active:bg-transparent`}
            autoComplete="off"
            autoFocus
            ref={inputRef}
          />
          {email.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setEmail("");
                inputRef.current?.focus();
              }}
              className="absolute right-3 grid size-5 place-items-center"
              aria-label="清空邮箱"
              tabIndex={-1}
            >
              <XCircle className="size-5 stroke-placeholder" />
            </button>
          )}
        </div>
        {emailError?.email && !isFocused && (
          <p className="flex items-center gap-1 px-0.5 text-11 text-danger-primary">
            <CircleAlert height={12} width={12} />
            请输入有效的邮箱地址
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" className="w-full" size="xl" disabled={isButtonDisabled}>
        {isSubmitting ? <Spinner height="20px" width="20px" /> : "继续"}
      </Button>
    </form>
  );
});
