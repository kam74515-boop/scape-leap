/**
 * 构境前端：拉用户 bootstrap，但不做登录门禁。
 * NON_AUTHENTICATED（/）自动进工作区 formscape。
 */
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { EPageTypes } from "@/helpers/authentication.helper";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

type TPageType = EPageTypes;

type TAuthenticationWrapper = {
  children: ReactNode;
  pageType?: TPageType;
};

const DEFAULT_WORKSPACE = "formscape";

export const AuthenticationWrapper = observer(function AuthenticationWrapper(props: TAuthenticationWrapper) {
  const { children, pageType = EPageTypes.AUTHENTICATED } = props;
  const router = useAppRouter();
  const { isLoading: isUserLoading, data: currentUser, fetchCurrentUser } = useUser();
  const { workspaces } = useWorkspace();

  const { isLoading: isUserSWRLoading } = useSWR("USER_INFORMATION", async () => await fetchCurrentUser(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  if ((isUserSWRLoading || isUserLoading) && !currentUser?.id) {
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  // 登录页 / 注册类页：有用户则直接进工作区
  if (pageType === EPageTypes.NON_AUTHENTICATED || pageType === EPageTypes.ONBOARDING) {
    const firstSlug = Object.values(workspaces || {})[0]?.slug;
    const target = `/${firstSlug || DEFAULT_WORKSPACE}`;
    router.replace(target);
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  // 其余页面：始终放行（无鉴权）
  return <>{children}</>;
});
