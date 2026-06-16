import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "@/shared/auth/AuthProvider";
import { FeedbackBridge } from "@/shared/feedback/FeedbackBridge";
import { QueryProvider } from "@/shared/query/queryClient";
import { queryClient } from "@/shared/query/queryClientInstance";
import { antdTheme } from "@/shared/theme/antdTheme";
import { antdWave } from "@/shared/theme/wave";
import { router } from "@/router/router";

export function AppProviders() {
  return (
    <ConfigProvider locale={zhCN} theme={antdTheme} wave={antdWave}>
      <AntdApp>
        <FeedbackBridge />
        <QueryProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
