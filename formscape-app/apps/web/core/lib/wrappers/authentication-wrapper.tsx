/** 登录态边界：工作台必须有用户；登录/注册页仅在已有会话时跳进工作区。 */
import { useEffect, type ReactNode } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { setFsDataAccess } from "@/components/formscape/fs-data-client";
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

  const isLoading = (isUserSWRLoading || isUserLoading) && !currentUser?.id;
  const firstSlug = Object.values(workspaces || {})[0]?.slug;
  let redirectTarget: string | null = null;

  if (!isLoading && pageType !== EPageTypes.PUBLIC) {
    if (pageType === EPageTypes.SET_PASSWORD) {
      if (!currentUser?.id) redirectTarget = "/";
    } else if (pageType === EPageTypes.NON_AUTHENTICATED) {
      if (currentUser?.id) redirectTarget = `/${firstSlug || DEFAULT_WORKSPACE}`;
    } else if (!currentUser?.id) {
      redirectTarget = "/";
    } else if (currentUser.is_password_autoset) {
      redirectTarget = `/accounts/set-password?email=${encodeURIComponent(currentUser.email)}`;
    }
  }

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  useEffect(() => {
    if (!isUserSWRLoading && !isUserLoading) setFsDataAccess(Boolean(currentUser?.id));
  }, [currentUser?.id, isUserLoading, isUserSWRLoading]);

  if (isLoading) {
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  if (pageType === EPageTypes.PUBLIC) {
    return <>{children}</>;
  }

  if (pageType === EPageTypes.SET_PASSWORD) {
    if (currentUser?.id) return <>{children}</>;
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  // 登录页 / 注册类页：仅在已有用户时进工作区，无会话时正常展示表单。
  if (pageType === EPageTypes.NON_AUTHENTICATED) {
    if (!currentUser?.id) return <>{children}</>;
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  if (!currentUser?.id) {
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  if (currentUser.is_password_autoset) {
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  return <>{children}</>;
});
