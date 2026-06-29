import { ROLE_LABELS, type User } from "@/shared/auth/types";

import "./UserHero.css";

function initials(name: string) {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.length > 2 ? trimmed.slice(0, 2) : trimmed[0];
}

interface UserHeroProps {
  user: User;
  variant?: "default" | "danger";
}

export function UserHero({ user, variant = "default" }: UserHeroProps) {
  return (
    <section className={`org-user-hero is-${variant} role-${user.role}`}>
      <span className="org-user-hero__avatar">{initials(user.name)}</span>
      <div className="org-user-hero__body">
        <div className="org-user-hero__title">
          <strong>{user.name}</strong>
          <span className="org-user-hero__employee-id">{user.aihub_username || user.id}</span>
        </div>
        <div className="org-user-hero__chips">
          <span className={`org-role-tag is-${user.role}`}>{ROLE_LABELS[user.role]}</span>
          <span className="org-user-hero__team">
            {user.team_name ? user.team_name : "无团队"}
          </span>
          {user.email ? <span className="org-user-hero__email">{user.email}</span> : null}
        </div>
      </div>
    </section>
  );
}
