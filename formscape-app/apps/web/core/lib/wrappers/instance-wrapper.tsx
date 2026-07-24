/**
 * 本地开发：实例检查已禁用 — 不显示 Maintenance / InstanceNotReady
 */
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { useInstance } from "@/hooks/store/use-instance";

type TInstanceWrapper = {
  children: ReactNode;
};

const InstanceWrapper = observer(function InstanceWrapper(props: TInstanceWrapper) {
  const { children } = props;
  const { isLoading, instance, fetchInstanceInfo } = useInstance();

  const { isLoading: isInstanceSWRLoading } = useSWR(
    "INSTANCE_INFORMATION",
    async () => {
      try {
        await fetchInstanceInfo();
      } catch {
        // mock / 无后端时忽略错误，继续渲染
      }
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  if ((isLoading || isInstanceSWRLoading) && !instance) {
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );
  }

  // 无论 instance 是否成功，都进入应用（本地无鉴权）
  return <>{children}</>;
});

export default InstanceWrapper;
