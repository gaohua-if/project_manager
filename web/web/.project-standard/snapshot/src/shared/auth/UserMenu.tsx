import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Dropdown, Skeleton, Space } from "antd";
import type { MenuProps } from "antd";
import { useNavigate } from "react-router-dom";

import { useAuth } from "./authContext";

export function UserMenu() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.nickname?.trim() || user?.username || (user ? `用户 ${user.id}` : "未登录");
  const userSummary = user?.roles?.[0]?.name || user?.email || "平台用户";

  const items: MenuProps["items"] = [
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
