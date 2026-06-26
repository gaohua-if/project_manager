import { CopyOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { App } from "antd";
import { Avatar, Dropdown, Skeleton, Space } from "antd";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";

import { ROLE_LABELS } from "./types";
import { useAuth } from "./authContext";
import { getAuthSession } from "./session";

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    const copied = await navigator.clipboard.writeText(text).then(
      () => true,
      () => false
    );
    if (copied) return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Token copy failed");
  }
}

export function UserMenu() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const displayName = user?.name?.trim() || user?.employee_id || "未登录";
  const userSummary = user
    ? `${ROLE_LABELS[user.role]}${user.team_name ? " · " + user.team_name : ""}`
    : "平台用户";

  const copyToken = async () => {
    const { token } = getAuthSession();
    if (!token) return;
    try {
      await copyText(token);
      void message.success("Token 已复制到剪贴板");
    } catch {
      void message.error("复制失败，请手动从 localStorage 获取");
    }
  };

  const items: MenuProps["items"] = [
    {
      key: "copyToken",
      icon: <CopyOutlined />,
      label: "复制 Token"
    },
    {
      type: "divider"
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录"
    }
  ];

  if (status === "initializing") {
    return (
      <div className="user-menu user-menu--loading" aria-label="正在恢复用户信息">
        <Skeleton.Avatar active size={28} />
        <span className="user-menu__loading-copy">
          <Skeleton.Input active size="small" />
          <Skeleton.Input active size="small" />
        </span>
      </div>
    );
  }

  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => {
          if (key === "logout") {
            logout();
            navigate("/login", { replace: true });
          } else if (key === "copyToken") {
            void copyToken();
          }
        }
      }}
    >
      <Space className="user-menu" size={8}>
        <Avatar size={28} icon={<UserOutlined />} />
        <span className="user-menu__copy">
          <strong>{displayName}</strong>
          <small>{userSummary}</small>
        </span>
      </Space>
    </Dropdown>
  );
}
