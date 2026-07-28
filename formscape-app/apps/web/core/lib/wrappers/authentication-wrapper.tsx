/** 登录态边界：工作台必须有用户；登录/注册页仅在已有会话时跳进工作区。 */
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

  if (pageType === EPageTypes.PUBLIC || pageType === EPageTypes.SET_PASSWORD) {
    return <>{children}</>;
  }

  // 登录页 / 注册类页：仅在已有用户时进工作区，无会话时正常展示表单。
  if (pageType === EPageTypes.NON_AUTHENTICATED) {
    if (!currentUser?.id) return <>{children}</>;
    const firstSlug = Object.values(workspaces || {})[0]?.slug;
    const target = `/${firstSlug || DEFAULT_WORKSPACE}`;
    router.replace(target);
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  if (!currentUser?.id) {
    router.replace("/");
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  return <>{children}</>;
});
