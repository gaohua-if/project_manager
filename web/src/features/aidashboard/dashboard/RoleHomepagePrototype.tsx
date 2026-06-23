import { Avatar, Button, Card, Col, Drawer, Progress, Row, Segmented, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  FlagOutlined,
  LinkOutlined,
  PlusOutlined,
  ProjectOutlined,
  ReloadOutlined,
  RightOutlined,
  ScheduleOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

import { TokenDistributionPie, TokenTrendChart } from "./charts";
import { StatCard } from "./shared";
import "./role-homepage.css";

type RoleHomeKey = "employee" | "tl" | "director" | "pm";
type Tone = "blue" | "green" | "orange" | "red" | "purple" | "gray";
type DirectorTokenRange = "day" | "week" | "month";
type DirectorReqFilter = "all" | "focused" | "risk";
type DirectorFocusType = "项目" | "需求" | "任务";

interface MetricItem {
  label: string;
  value: string;
  note: string;
  tone: Tone;
}

interface ActionItem {
  title: string;
  desc: string;
  meta: string;
  tag: string;
  tone: Tone;
  to: string;
  action: string;
}

interface SimpleRow {
  key: string;
  name: string;
  status: string;
  owner: string;
  progress: number;
  note: string;
}

interface DirectorRequirementRow {
  key: string;
  name: string;
  status: string;
  owner: string;
  progress: number;
  ac: string;
  deadline: string;
  focus: string;
}

interface DirectorTeamRow {
  name: string;
  active: string;
  todaySessions: number;
  weekSessions: number;
  reportStatus: string;
  rate: number;
}

interface DirectorFocusChange {
  key: string;
  type: DirectorFocusType;
  name: string;
  change: string;
  relation: string;
  updatedAt: string;
}

interface DirectorFocusItem extends DirectorFocusChange {
  status: string;
  risk: string;
}

interface PMActionItem {
  key: string;
  priority: "高" | "中";
  requirement: string;
  triggerReason: string;
  status: string;
  owner: string;
  nextAction: string;
  deadline: string;
  action: string;
  to: string;
}

interface PMActiveRequirement {
  key: string;
  name: string;
  focusSource: string;
  ac: string;
  taskProgress: number;
  blockStatus: string;
  weekSessions: number;
  weekToken: string;
  deadline: string;
  to: string;
  feishuUrl: string;
}

interface PMFollowTask {
  key: string;
  name: string;
  requirement: string;
  status: string;
  owner: string;
  deadline: string;
  note: string;
  to: string;
}

interface TLRiskItem {
  key: string;
  title: string;
  count: number;
  meta: string;
  ownerLabel: string;
  owner: string;
  secondaryLabel: string;
  secondaryValue: string;
  tone: "red" | "orange" | "gold";
  to: string;
}

interface TLMetricItem {
  label: string;
  value: string;
  delta: string;
  tone: "blue" | "purple" | "red" | "orange";
}

interface TLTodoRow {
  key: string;
  title: string;
  owner: string;
  tag?: string;
  time: string;
  to: string;
}

interface TLTodoGroup {
  key: string;
  title: string;
  count: number;
  subtitle: string;
  tone: "purple" | "orange";
  rows: TLTodoRow[];
}

interface TLTaskStatusItem {
  label: string;
  value: number;
  percent: string;
  color: string;
}

interface TLWorkEvidenceTask {
  key: string;
  task: string;
  owner: string;
  requirement: string;
  deadline: string;
  missingDays: string;
  focusLevel: string;
  to: string;
}

interface TLActivityItem {
  key: string;
  title: string;
  desc: string;
  time: string;
  tone: "red" | "purple" | "green" | "orange";
}

interface TLQuickAction {
  key: string;
  label: string;
  tone: "green" | "blue" | "orange" | "gold" | "purple";
  icon: ReactNode;
  to: string;
}

interface RoleHomeData {
  title: string;
  description: string;
  eyebrow: string;
  intent: string;
  primaryTitle: string;
  primaryIcon: ReactNode;
  primary: ActionItem[];
  secondaryTitle: string;
  secondaryIcon: ReactNode;
  secondary: SimpleRow[];
  sideTitle: string;
  side: ActionItem[];
  metrics: MetricItem[];
  evidenceTitle: string;
  evidence: string[];
  timeline: string[];
}

const roleData: Record<RoleHomeKey, RoleHomeData> = {
  employee: {
    title: "员工首页",
    description: "Session 上报、飞书日报/周报、个人 Token、被关注任务",
    eyebrow: "个人执行工作台",
    intent: "优先完成个人上报、报告确认和被关注任务的进展补齐。",
    primaryTitle: "今日待处理",
    primaryIcon: <UploadOutlined />,
    primary: [
      {
        title: "补齐 T-128 的 Session 记录",
        desc: "TL 已关注，明天到期。今天有 2 条 Claude Code Session 待绑定到任务。",
        meta: "被关注任务 · 工作记录待补齐",
        tag: "待上报",
        tone: "orange",
        to: "/sessions",
        action: "去上报"
      },
      {
        title: "确认个人日报草稿",
        desc: "日报已生成，包含 3 个任务进展和今日 Session 摘要，需要本人确认后进入飞书链接占位。",
        meta: "飞书日报/周报 · 链接占位",
        tag: "待确认",
        tone: "blue",
        to: "/reports",
        action: "看报告"
      },
      {
        title: "更新接口输出任务状态",
        desc: "下游 T-143 等待你的输出，需求被 PM 关注。需要补充进展或说明阻塞。",
        meta: "被关注任务 · 下游等待",
        tag: "需更新",
        tone: "red",
        to: "/tasks",
        action: "看任务"
      }
    ],
    secondaryTitle: "被关注任务",
    secondaryIcon: <FlagOutlined />,
    secondary: [
      {
        key: "T-128",
        name: "权限回归用例补齐",
        status: "TL 关注",
        owner: "张三",
        progress: 65,
        note: "缺 Session 绑定"
      },
      {
        key: "T-121",
        name: "接口输出整理",
        status: "PM 关注",
        owner: "张三",
        progress: 80,
        note: "下游等待"
      },
      {
        key: "T-109",
        name: "日报摘要核对",
        status: "普通",
        owner: "张三",
        progress: 40,
        note: "报告草稿待确认"
      }
    ],
    sideTitle: "飞书与个人证据",
    side: [
      {
        title: "个人日报链接",
        desc: "飞书链接入口占位，真实写入以正式 PRD 为准。",
        meta: "日报 · 20:00",
        tag: "链接占位",
        tone: "blue",
        to: "/reports",
        action: "打开"
      },
      {
        title: "个人周报链接",
        desc: "周五生成后展示链接入口，首页只验证入口位置。",
        meta: "周报 · 周五",
        tag: "未生成",
        tone: "gray",
        to: "/reports",
        action: "打开"
      }
    ],
    metrics: [
      { label: "待上报 Session", value: "2", note: "今日", tone: "orange" },
      { label: "日报状态", value: "待确认", note: "链接占位", tone: "blue" },
      { label: "被关注任务", value: "2", note: "TL/PM", tone: "red" },
      { label: "今日 Token", value: "186K", note: "辅助证据", tone: "purple" }
    ],
    evidenceTitle: "个人 Token / Session",
    evidence: ["今日 186K", "本周 594K", "T-128 86K", "Sonnet 72%"],
    timeline: ["09:42 TL 关注 T-128", "09:10 2 条 Session 待绑定", "08:50 日报草稿已生成"]
  },
  tl: {
    title: "TL 首页",
    description: "任务拆解 + AC 关联、团队报告、成员面板、本队 Token、上级关注事项",
    eyebrow: "团队执行工作台",
    intent: "优先处理上级关注、任务拆解缺口、AC 关联和团队报告 Review。",
    primaryTitle: "上级关注与拆解缺口",
    primaryIcon: <CheckSquareOutlined />,
    primary: [
      {
        title: "REQ-042 还有 3 个 AC 未关联任务",
        desc: "PM 已关注该需求，统一权限模型需要补齐 AC 到任务的拆解关系。",
        meta: "任务拆解 + AC 关联",
        tag: "缺关联",
        tone: "red",
        to: "/requirements",
        action: "看需求"
      },
      {
        title: "T-143 跨团队接口联调阻塞",
        desc: "阻塞超过 1 天，属于上级关注需求。需要 TL 补充处理意见。",
        meta: "上级关注事项",
        tag: "阻塞",
        tone: "orange",
        to: "/tasks",
        action: "看任务"
      },
      {
        title: "2 份团队日报待 Review",
        desc: "其中 1 份缺任务关联，Review 后展示团队飞书报告链接入口。",
        meta: "团队报告",
        tag: "待 Review",
        tone: "blue",
        to: "/reports",
        action: "看报告"
      }
    ],
    secondaryTitle: "成员面板",
    secondaryIcon: <TeamOutlined />,
    secondary: [
      {
        key: "u-zhang",
        name: "张三 · T-128 权限回归",
        status: "进行中",
        owner: "AI 工程",
        progress: 65,
        note: "缺 Session"
      },
      {
        key: "u-li",
        name: "李四 · T-143 接口联调",
        status: "阻塞",
        owner: "AI 工程",
        progress: 35,
        note: "PM 关注"
      },
      {
        key: "u-wang",
        name: "王五 · 日报补充",
        status: "待 Review",
        owner: "AI 工程",
        progress: 50,
        note: "缺任务关联"
      }
    ],
    sideTitle: "团队报告与本队 Token",
    side: [
      {
        title: "团队日报链接",
        desc: "Review 后展示飞书链接入口，首页不实现真实写入。",
        meta: "团队报告",
        tag: "待 Review",
        tone: "blue",
        to: "/reports",
        action: "Review"
      },
      {
        title: "本队 Token",
        desc: "只作为团队活跃和工作证据辅助信号。",
        meta: "本周 12.9M",
        tag: "辅助",
        tone: "purple",
        to: "/tokens",
        action: "查看"
      }
    ],
    metrics: [
      { label: "待拆 AC", value: "3", note: "REQ-042", tone: "red" },
      { label: "团队报告", value: "2", note: "待 Review", tone: "blue" },
      { label: "今日活跃", value: "11/13", note: "有 Session", tone: "green" },
      { label: "本队 Token", value: "1.4M", note: "辅助", tone: "purple" }
    ],
    evidenceTitle: "本队 Token",
    evidence: ["本周 12.9M", "张三 594K", "T-143 420K", "Sonnet 61%"],
    timeline: ["10:15 PM 关注 REQ-042", "09:52 王五日报缺任务关联", "09:31 张三上传 4 个 Session"]
  },
  director: {
    title: "总监首页",
    description: "关键事项概览",
    eyebrow: "部门态势工作台",
    intent: "优先看部门需求总览、整体风险、团队活跃和重点需求，不做一线待办处理台。",
    primaryTitle: "部门需求总览和整体风险",
    primaryIcon: <ProjectOutlined />,
    primary: [
      {
        title: "REQ-005 安全加固专项超期",
        desc: "进度 33%，跨 AI 工程与模型训练。重点关注让它在首页和报告中更显眼，但不改变正式优先级。",
        meta: "部门需求总览 · 整体风险",
        tag: "超期",
        tone: "red",
        to: "/requirements",
        action: "看需求"
      },
      {
        title: "REQ-042 统一权限模型跨团队阻塞",
        desc: "AI 工程到推理加速的接口依赖阻塞超过 1 天，PM 已介入。",
        meta: "跨团队风险",
        tag: "PM 已介入",
        tone: "orange",
        to: "/requirements",
        action: "看需求"
      },
      {
        title: "部门日报入口",
        desc: "展示部门报告飞书链接占位和生成状态，真实写入以正式 PRD 为准。",
        meta: "部门报告",
        tag: "链接占位",
        tone: "blue",
        to: "/reports",
        action: "看报告"
      }
    ],
    secondaryTitle: "重点关注需求",
    secondaryIcon: <FlagOutlined />,
    secondary: [
      {
        key: "REQ-005",
        name: "安全加固专项",
        status: "总监关注",
        owner: "AI 工程 + 模型训练",
        progress: 33,
        note: "超期"
      },
      {
        key: "REQ-042",
        name: "统一权限模型",
        status: "PM 关注",
        owner: "AI 工程 + 推理加速",
        progress: 71,
        note: "跨团队阻塞"
      },
      {
        key: "REQ-001",
        name: "AI 平台 v3.0",
        status: "重点",
        owner: "AI 工程",
        progress: 76,
        note: "本周稳定推进"
      }
    ],
    sideTitle: "部门报告与团队活跃",
    side: [
      {
        title: "部门周报链接",
        desc: "周五生成后展示飞书链接入口。",
        meta: "部门报告",
        tag: "未生成",
        tone: "gray",
        to: "/reports",
        action: "查看"
      },
      {
        title: "团队活跃度",
        desc: "看团队级 Session 活跃，不做个人 Token 排名管理视图。",
        meta: "37/42 活跃",
        tag: "团队级",
        tone: "green",
        to: "/organization",
        action: "查看"
      }
    ],
    metrics: [
      { label: "进行中需求", value: "12", note: "进行中", tone: "blue" },
      { label: "整体风险", value: "3", note: "跨团队/超期", tone: "red" },
      { label: "团队活跃", value: "37/42", note: "团队级", tone: "green" },
      { label: "Token 趋势", value: "+8%", note: "辅助", tone: "purple" }
    ],
    evidenceTitle: "Token 趋势",
    evidence: ["本周 22.5M", "较上周 +8%", "Sonnet 55%", "部门级趋势"],
    timeline: ["10:44 PM 为跨团队阻塞补充结论", "10:30 总监关注 REQ-005", "09:50 部门日报草稿已生成"]
  },
  pm: {
    title: "PM 首页",
    description: "重点关注需求、验收标准追踪、PM 报告、跨团队阻塞 / 推进异常",
    eyebrow: "需求健康工作台",
    intent: "优先看重点需求、验收标准缺口、PM 报告、跨团队阻塞和需求推进异常。",
    primaryTitle: "重点关注需求",
    primaryIcon: <FlagOutlined />,
    primary: [
      {
        title: "REQ-051 智能工单归因缺验收标准",
        desc: "总监关注，但验收标准缺失，暂不适合进入拆任务阶段。",
        meta: "重点关注需求",
        tag: "缺验收标准",
        tone: "red",
        to: "/requirements",
        action: "看需求"
      },
      {
        title: "REQ-042 统一权限模型跨团队阻塞",
        desc: "AI 工程到推理加速依赖超过 1 天，TL 已补充阻塞说明。",
        meta: "跨团队阻塞",
        tag: "需协调",
        tone: "orange",
        to: "/requirements",
        action: "看需求"
      },
      {
        title: "PM 周报入口",
        desc: "PM 报告链接入口占位，真实飞书写入以正式 PRD 为准。",
        meta: "PM 报告",
        tag: "链接占位",
        tone: "blue",
        to: "/reports",
        action: "看报告"
      }
    ],
    secondaryTitle: "验收标准追踪",
    secondaryIcon: <CheckSquareOutlined />,
    secondary: [
      {
        key: "REQ-051",
        name: "智能工单归因",
        status: "缺验收标准",
        owner: "PM 陈",
        progress: 0,
        note: "今日补齐验收标准"
      },
      {
        key: "REQ-042",
        name: "统一权限模型",
        status: "验收标准 5/7",
        owner: "AI 工程",
        progress: 71,
        note: "跨团队阻塞"
      },
      {
        key: "REQ-037",
        name: "日报自动汇总",
        status: "验收标准 3/6",
        owner: "PM 陈",
        progress: 50,
        note: "高工作量低进展"
      }
    ],
    sideTitle: "PM 报告与推进异常",
    side: [
      {
        title: "REQ-037 进展异常",
        desc: "验收标准和任务状态 2 天无变化，需要 PM 确认范围或推动 TL 更新拆解。",
        meta: "推进异常",
        tag: "需确认",
        tone: "orange",
        to: "/requirements",
        action: "看需求"
      },
      {
        title: "REQ-042 跨团队依赖",
        desc: "接口联调阻塞超过 1 天，TL 已补充说明，PM 需要确认下一步负责人。",
        meta: "跨团队阻塞",
        tag: "待协调",
        tone: "red",
        to: "/requirements",
        action: "看需求"
      }
    ],
    metrics: [
      { label: "重点需求", value: "5", note: "2 个高关注", tone: "blue" },
      { label: "缺验收标准", value: "2", note: "影响拆解", tone: "red" },
      { label: "跨团队阻塞", value: "1", note: "超过 1 天", tone: "orange" },
      { label: "推进异常", value: "2", note: "待 PM 判断", tone: "purple" }
    ],
    evidenceTitle: "PM 报告",
    evidence: ["PM 周报入口", "重点需求摘要", "验收标准风险清单", "跨团队阻塞清单"],
    timeline: ["10:30 总监关注 REQ-051", "10:02 TL 为 REQ-042 补充说明", "09:18 REQ-037 进展待确认"]
  }
};

const directorRequirements: DirectorRequirementRow[] = [
  {
    key: "REQ-001",
    name: "AI 平台 v3.0",
    status: "进行中",
    owner: "AI 工程",
    progress: 76,
    ac: "5/7",
    deadline: "07-30",
    focus: "重点关注"
  },
  {
    key: "REQ-003",
    name: "用户中心统一认证",
    status: "进行中",
    owner: "推理加速",
    progress: 67,
    ac: "4/6",
    deadline: "07-05",
    focus: "普通"
  },
  {
    key: "REQ-005",
    name: "安全加固专项",
    status: "风险/阻塞",
    owner: "AI 工程 + 模型训练",
    progress: 33,
    ac: "1/3",
    deadline: "06-28",
    focus: "重点关注"
  },
  {
    key: "REQ-009",
    name: "日报自动汇总",
    status: "已完成",
    owner: "模型训练",
    progress: 100,
    ac: "6/6",
    deadline: "06-18",
    focus: "普通"
  }
];

const directorTeams: DirectorTeamRow[] = [
  {
    name: "AI 工程",
    active: "14/16",
    todaySessions: 64,
    weekSessions: 318,
    reportStatus: "日报已生成",
    rate: 88
  },
  {
    name: "推理加速",
    active: "11/13",
    todaySessions: 48,
    weekSessions: 241,
    reportStatus: "日报待确认",
    rate: 85
  },
  {
    name: "模型训练",
    active: "12/13",
    todaySessions: 52,
    weekSessions: 266,
    reportStatus: "日报已生成",
    rate: 92
  }
];

const directorTokenData: Record<
  DirectorTokenRange,
  {
    total: string;
    change: string;
    points: number[];
    models: { key: string; label: string; value: number; percent: number }[];
  }
> = {
  day: {
    total: "3.2M",
    change: "较昨日 +4%",
    points: [420_000, 560_000, 480_000, 670_000, 620_000, 760_000, 700_000],
    models: [
      { key: "sonnet", label: "Sonnet", value: 1_760_000, percent: 55 },
      { key: "opus", label: "Opus", value: 800_000, percent: 25 },
      { key: "gpt5", label: "GPT-5", value: 640_000, percent: 20 }
    ]
  },
  week: {
    total: "22.5M",
    change: "较上周 +8%",
    points: [2_800_000, 3_100_000, 3_400_000, 3_000_000, 3_700_000, 3_400_000, 3_100_000],
    models: [
      { key: "sonnet", label: "Sonnet", value: 13_050_000, percent: 58 },
      { key: "opus", label: "Opus", value: 4_950_000, percent: 22 },
      { key: "gpt5", label: "GPT-5", value: 4_500_000, percent: 20 }
    ]
  },
  month: {
    total: "285M",
    change: "较上月 +11%",
    points: [31_000_000, 36_000_000, 39_000_000, 44_000_000, 42_000_000, 47_000_000, 46_000_000],
    models: [
      { key: "sonnet", label: "Sonnet", value: 173_850_000, percent: 61 },
      { key: "opus", label: "Opus", value: 59_850_000, percent: 21 },
      { key: "gpt5", label: "GPT-5", value: 51_300_000, percent: 18 }
    ]
  }
};

const directorFocusChanges: DirectorFocusChange[] = [
  {
    key: "T-128",
    type: "任务",
    name: "权限回归用例补齐",
    change: "已补充 Session",
    relation: "关联 REQ-005 安全加固专项",
    updatedAt: "今天 18:40"
  },
  {
    key: "REQ-042",
    type: "需求",
    name: "统一权限模型",
    change: "跨团队依赖已由 PM 介入",
    relation: "关联 AI 平台 v3.0",
    updatedAt: "今天 16:20"
  },
  {
    key: "T-116",
    type: "任务",
    name: "接口联调验证",
    change: "状态从进行中变为待确认",
    relation: "关联 REQ-003 用户中心统一认证",
    updatedAt: "今天 15:05"
  }
];

const directorFocusItems: DirectorFocusItem[] = [
  {
    key: "P-001",
    type: "项目",
    name: "AI 平台 v3.0",
    status: "推进中",
    relation: "部门重点项目",
    change: "本周完成 2 个里程碑",
    risk: "否",
    updatedAt: "今天 17:30"
  },
  {
    key: "P-002",
    type: "项目",
    name: "推理服务稳定性专项",
    status: "推进中",
    relation: "推理加速团队",
    change: "周报已生成",
    risk: "否",
    updatedAt: "昨天 19:10"
  },
  {
    key: "REQ-005",
    type: "需求",
    name: "安全加固专项",
    status: "风险/阻塞",
    relation: "关联 AI 平台 v3.0",
    change: "出现超期信号",
    risk: "是",
    updatedAt: "今天 18:10"
  },
  {
    key: "REQ-042",
    type: "需求",
    name: "统一权限模型",
    status: "进行中",
    relation: "关联 AI 平台 v3.0",
    change: "PM 已介入跨团队依赖",
    risk: "否",
    updatedAt: "今天 16:20"
  },
  {
    key: "T-128",
    type: "任务",
    name: "权限回归用例补齐",
    status: "进行中",
    relation: "关联 REQ-005 安全加固专项",
    change: "已补充 Session",
    risk: "否",
    updatedAt: "今天 18:40"
  },
  {
    key: "T-116",
    type: "任务",
    name: "接口联调验证",
    status: "待确认",
    relation: "关联 REQ-003 用户中心统一认证",
    change: "状态变更为待确认",
    risk: "否",
    updatedAt: "今天 15:05"
  }
];

const pmActionItems: PMActionItem[] = [
  {
    key: "REQ-001",
    priority: "高",
    requirement: "统一权限模型",
    triggerReason: "总监关注 · 缺验收标准",
    status: "AC 5/7",
    owner: "PM 陈",
    nextAction: "补齐验收标准",
    deadline: "07-12",
    action: "查看需求",
    to: "/requirements"
  },
  {
    key: "REQ-005",
    priority: "高",
    requirement: "跨团队发布校验",
    triggerReason: "跨团队依赖等待 1 天以上",
    status: "PM 已介入",
    owner: "AI 工程 TL 王",
    nextAction: "添加协调结论",
    deadline: "07-10",
    action: "查看阻塞",
    to: "/tasks"
  },
  {
    key: "REQ-003",
    priority: "中",
    requirement: "日报自动汇总",
    triggerReason: "高 Session 但进度无变化",
    status: "任务未推进",
    owner: "TL 李",
    nextAction: "检查任务拆解/范围",
    deadline: "07-15",
    action: "查看摘要",
    to: "/requirements"
  }
];

const pmActiveRequirements: PMActiveRequirement[] = [
  {
    key: "REQ-051",
    name: "统一权限模型",
    focusSource: "总监关注",
    ac: "5/7",
    taskProgress: 71,
    blockStatus: "缺验收标准",
    weekSessions: 18,
    weekToken: "42K",
    deadline: "07-12",
    to: "/requirements",
    feishuUrl: "https://feishu.cn/docx/aida-req-051"
  },
  {
    key: "REQ-042",
    name: "智能工单归因",
    focusSource: "PM 关注",
    ac: "3/5",
    taskProgress: 58,
    blockStatus: "依赖中",
    weekSessions: 12,
    weekToken: "68K",
    deadline: "07-10",
    to: "/tasks",
    feishuUrl: "https://feishu.cn/docx/aida-req-042"
  },
  {
    key: "REQ-037",
    name: "日报自动汇总",
    focusSource: "-",
    ac: "4/6",
    taskProgress: 67,
    blockStatus: "无明显阻塞",
    weekSessions: 22,
    weekToken: "126K",
    deadline: "07-15",
    to: "/requirements",
    feishuUrl: "https://feishu.cn/docx/aida-req-037"
  },
  {
    key: "REQ-029",
    name: "跨团队发布校验",
    focusSource: "总监关注",
    ac: "2/5",
    taskProgress: 39,
    blockStatus: "跨团队阻塞",
    weekSessions: 6,
    weekToken: "35K",
    deadline: "07-10",
    to: "/requirements",
    feishuUrl: "https://feishu.cn/docx/aida-req-029"
  },
  {
    key: "REQ-033",
    name: "验收标准模板治理",
    focusSource: "-",
    ac: "4/4",
    taskProgress: 90,
    blockStatus: "健康",
    weekSessions: 5,
    weekToken: "18K",
    deadline: "07-20",
    to: "/requirements",
    feishuUrl: "https://feishu.cn/docx/aida-req-033"
  }
];

const pmFollowTasks: PMFollowTask[] = [
  {
    key: "TASK-151",
    name: "补充统一权限模型验收标准",
    requirement: "REQ-051",
    status: "待处理",
    owner: "PM 陈",
    deadline: "07-12",
    note: "总监反馈缺少验收标准，需明确角色边界",
    to: "/tasks"
  },
  {
    key: "TASK-142",
    name: "确认接口输出时间",
    requirement: "REQ-042",
    status: "进行中",
    owner: "AI 工程 TL 王",
    deadline: "07-10",
    note: "上游接口输出时间待确认",
    to: "/tasks"
  },
  {
    key: "TASK-137",
    name: "更新日报自动汇总任务拆解",
    requirement: "REQ-037",
    status: "待处理",
    owner: "TL 李",
    deadline: "07-15",
    note: "Session 高但进度无变化",
    to: "/tasks"
  },
  {
    key: "TASK-129",
    name: "同步发布校验截止时间",
    requirement: "REQ-029",
    status: "待处理",
    owner: "AI 工程",
    deadline: "07-10",
    note: "跨团队依赖等待中，需确认时间",
    to: "/tasks"
  }
];

const tlRiskItems: TLRiskItem[] = [
  {
    key: "risk-blocked",
    title: "高关注度未下阻塞任务",
    count: 1,
    meta: "阻塞超过 1 天",
    ownerLabel: "负责人",
    owner: "王五",
    secondaryLabel: "阻塞时长",
    secondaryValue: "1天6小时",
    tone: "red",
    to: "/tasks"
  },
  {
    key: "risk-evidence",
    title: "进行中任务缺少工作证据",
    count: 3,
    meta: "收录日 +1",
    ownerLabel: "其中 1 个被重点关注",
    owner: "需关注处理",
    secondaryLabel: "",
    secondaryValue: "",
    tone: "orange",
    to: "/sessions"
  },
  {
    key: "risk-deadline",
    title: "临近 Deadline 风险",
    count: 2,
    meta: "3 天内到期",
    ownerLabel: "涉及需求",
    owner: "2 个",
    secondaryLabel: "需确认",
    secondaryValue: "截止时间",
    tone: "gold",
    to: "/tasks"
  }
];

const tlMetrics: TLMetricItem[] = [
  { label: "今日活跃", value: "11/13", delta: "较昨日 +2", tone: "blue" },
  { label: "参与需求", value: "4", delta: "较昨日 -", tone: "purple" },
  { label: "阻塞预警", value: "1", delta: "较昨日 +1", tone: "red" },
  { label: "本队 Token", value: "1.84M", delta: "较昨日 +123K", tone: "orange" }
];

const tlTodoGroups: TLTodoGroup[] = [
  {
    key: "daily-review",
    title: "日报待 Review",
    count: 2,
    subtitle: "其中 2 份缺任务关联",
    tone: "purple",
    rows: [
      { key: "review-li", title: "缺任务关联", owner: "李四", tag: "缺任务关联", time: "提交于 17:26", to: "/reports" },
      { key: "review-qian", title: "缺任务关联", owner: "钱七", tag: "缺任务关联", time: "提交于 16:48", to: "/reports" }
    ]
  },
  {
    key: "need-handle",
    title: "需要您处理的任务",
    count: 2,
    subtitle: "请确认需求变更与资源调整",
    tone: "orange",
    rows: [
      { key: "req-001", title: "REQ-001 需求变更确认", owner: "张三", time: "提交于 15:14", to: "/requirements" },
      { key: "req-004", title: "REQ-004 资源调整申请", owner: "赵六", time: "提交于 14:02", to: "/requirements" }
    ]
  }
];

const tlTaskStatusItems: TLTaskStatusItem[] = [
  { label: "进行中", value: 7, percent: "39%", color: "#1677ff" },
  { label: "待开始", value: 5, percent: "28%", color: "#52c41a" },
  { label: "已完成", value: 4, percent: "22%", color: "#722ed1" },
  { label: "已阻塞", value: 2, percent: "11%", color: "#ff4d4f" }
];

const tlEvidenceTasks: TLWorkEvidenceTask[] = [
  {
    key: "T-102",
    task: "梳理加速优化",
    owner: "李四",
    requirement: "REQ-002",
    deadline: "06-10",
    missingDays: "3 天",
    focusLevel: "总监关注",
    to: "/tasks"
  },
  {
    key: "T-105",
    task: "接口性能优化",
    owner: "钱七",
    requirement: "REQ-003",
    deadline: "06-15",
    missingDays: "2 天",
    focusLevel: "中",
    to: "/tasks"
  },
  {
    key: "T-108",
    task: "日志系统改造",
    owner: "赵六",
    requirement: "REQ-005",
    deadline: "06-20",
    missingDays: "2 天",
    focusLevel: "低",
    to: "/tasks"
  }
];

const tlActivities: TLActivityItem[] = [
  {
    key: "activity-1",
    title: "任务 T-201（数据导入模块）阻塞已超过 1 天",
    desc: "负责人：王五｜阻塞原因：第三方接口未返回数据",
    time: "18 分钟前",
    tone: "red"
  },
  {
    key: "activity-2",
    title: "李四 提交了日报，待您 Review（缺任务关联）",
    desc: "日报中有 2 条工作记录待绑定任务",
    time: "17:26",
    tone: "purple"
  },
  {
    key: "activity-3",
    title: "任务 T-101 已完成",
    desc: "负责人：张三",
    time: "16:40",
    tone: "green"
  },
  {
    key: "activity-4",
    title: "REQ-001 需求变更申请待您处理",
    desc: "提交人：张三",
    time: "15:14",
    tone: "orange"
  }
];

const tlQuickActions: TLQuickAction[] = [
  { key: "create", label: "创建任务", tone: "green", icon: <PlusOutlined />, to: "/tasks" },
  { key: "assign", label: "分配需求", tone: "blue", icon: <ProjectOutlined />, to: "/requirements" },
  { key: "block", label: "发现阻塞登记", tone: "orange", icon: <WarningOutlined />, to: "/tasks" },
  { key: "remind", label: "提醒补充记录", tone: "gold", icon: <BellOutlined />, to: "/sessions" },
  { key: "export", label: "导出日报", tone: "purple", icon: <FileTextOutlined />, to: "/reports" }
];

const rowColumns: ColumnsType<SimpleRow> = [
  {
    title: "对象",
    dataIndex: "name",
    render: (name: string, row) => (
      <Space orientation="vertical" size={0}>
        <Link to={row.key.startsWith("REQ") ? "/requirements" : "/tasks"}>{name}</Link>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {row.key}
        </Typography.Text>
      </Space>
    )
  },
  {
    title: "状态",
    dataIndex: "status",
    width: 110,
    render: (status: string) => <Tag>{status}</Tag>
  },
  {
    title: "负责人/范围",
    dataIndex: "owner",
    width: 150
  },
  {
    title: "进度",
    dataIndex: "progress",
    width: 150,
    render: (progress: number) => <Progress percent={progress} size="small" />
  },
  {
    title: "说明",
    dataIndex: "note",
    width: 150
  }
];

export function RoleHomepagePrototype({ role }: { role: RoleHomeKey }) {
  if (role === "director") {
    return <DirectorHomepagePrototype />;
  }
  if (role === "pm") {
    return <PMHomepagePrototype />;
  }
  if (role === "tl") {
    return <TLHomepagePrototype />;
  }

  const data = roleData[role];

  return (
    <PagePanel title={data.title} description={data.description} breadcrumbs={[{ title: "Dashboard" }]}>
      <div className={`role-home role-home--${role}`}>
        <section className="role-home__hero">
          <div>
            <span className="role-home__eyebrow">{data.eyebrow}</span>
            <h2>{data.intent}</h2>
          </div>
          <div className="role-home__source">
            <FileTextOutlined />
            <span>依据：旧 PRD 角色模块 + 决策 001</span>
          </div>
        </section>

        <div className="role-home__metrics">
          {data.metrics.map((metric) => (
            <div className={`role-home-metric role-home-metric--${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <em>{metric.note}</em>
            </div>
          ))}
        </div>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={15}>
            <Card
              className="role-home-card role-home-card--primary"
              title={
                <Space>
                  {data.primaryIcon}
                  {data.primaryTitle}
                </Space>
              }
            >
              <div className="role-home-action-list">
                {data.primary.map((item) => (
                  <ActionCard item={item} key={item.title} />
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={24} xl={9}>
            <Card
              className="role-home-card"
              title={
                <Space>
                  <LinkOutlined />
                  {data.sideTitle}
                </Space>
              }
            >
              <div className="role-home-side-list">
                {data.side.map((item) => (
                  <ActionCard compact item={item} key={item.title} />
                ))}
              </div>
              <div className="role-home-evidence">
                <div className="role-home-evidence__title">
                  <ThunderboltOutlined />
                  <span>{data.evidenceTitle}</span>
                </div>
                <div className="role-home-evidence__pills">
                  {data.evidence.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={16}>
            <Card
              className="role-home-card"
              title={
                <Space>
                  {data.secondaryIcon}
                  {data.secondaryTitle}
                </Space>
              }
            >
              <Table<SimpleRow>
                size="small"
                rowKey="key"
                columns={rowColumns}
                dataSource={data.secondary}
                pagination={false}
              />
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card
              className="role-home-card"
              title={
                <Space>
                  <BarChartOutlined />
                  最近动态
                </Space>
              }
            >
              <ol className="role-home-timeline">
                {data.timeline.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </Card>
          </Col>
        </Row>
      </div>
    </PagePanel>
  );
}

function TLHomepagePrototype() {
  const activityIcon = (tone: TLActivityItem["tone"]) => {
    if (tone === "red") return <AlertOutlined />;
    if (tone === "purple") return <FileTextOutlined />;
    if (tone === "green") return <CheckSquareOutlined />;
    return <WarningOutlined />;
  };
  const focusColor = (value: string) => {
    if (value === "总监关注") return "red";
    if (value === "中") return "orange";
    return "default";
  };

  const evidenceColumns: ColumnsType<TLWorkEvidenceTask> = [
    {
      title: "任务",
      dataIndex: "task",
      render: (task: string, row) => <Link to={row.to}>{row.key} {task}</Link>
    },
    { title: "负责人", dataIndex: "owner", width: 90 },
    { title: "需求", dataIndex: "requirement", width: 105 },
    { title: "Deadline", dataIndex: "deadline", width: 95 },
    {
      title: "无证据天数",
      dataIndex: "missingDays",
      width: 105,
      render: (days: string) => <Typography.Text type="danger">{days}</Typography.Text>
    },
    {
      title: "关注等级",
      dataIndex: "focusLevel",
      width: 105,
      render: (level: string) => <Tag color={focusColor(level)}>{level}</Tag>
    },
    {
      title: "操作",
      width: 70,
      render: (_, row) => <Link to={row.to}>查看</Link>
    }
  ];

  return (
    <PagePanel title="首页" description="团队关键情况" breadcrumbs={[{ title: "Dashboard" }]} showNav={false}>
      <div className="role-home role-home--tl-workbench">
        <section className="tl-home-head">
          <div>
            <h2>晚上好，刘TL 👋</h2>
            <p>以下是团队今日的关键状况，请及时关注与处理</p>
          </div>
          <Space className="tl-home-actions" wrap>
            <Button icon={<AppstoreOutlined />}>自定义首页</Button>
            <Button icon={<ReloadOutlined />}>数据刷新｜1 分钟前</Button>
          </Space>
        </section>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={14}>
            <Card
              className="role-home-card tl-panel-card tl-risk-panel"
              title={
                <Space>
                  <AlertOutlined />
                  风险与阻塞（3）
                </Space>
              }
              extra={<RightOutlined />}
            >
              <div className="tl-risk-grid">
                {tlRiskItems.map((item) => (
                  <div className={`tl-risk-card tl-risk-card--${item.tone}`} key={item.key}>
                    <strong>{item.title}</strong>
                    <div className="tl-risk-card__body">
                      <div className="tl-risk-card__count">
                        <span>{item.count}</span>
                        <em>↑</em>
                      </div>
                      <div className="tl-risk-card__divider" />
                      <div className="tl-risk-card__meta">
                        <small>{item.ownerLabel}</small>
                        <b>{item.owner}</b>
                        {item.secondaryLabel ? (
                          <>
                            <small>{item.secondaryLabel}</small>
                            <b>{item.secondaryValue}</b>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="tl-risk-card__footer">
                      <span>{item.meta}</span>
                      <Link to={item.to}>
                        查看详情 <RightOutlined />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card
              className="role-home-card tl-panel-card tl-metric-panel"
              title={
                <Space>
                  <BarChartOutlined />
                  今日关键数据
                </Space>
              }
            >
              <div className="tl-metric-grid">
                {tlMetrics.map((item) => (
                  <div className={`tl-metric-item tl-metric-item--${item.tone}`} key={item.label}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                    <em>{item.delta}</em>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={12}>
            <Card
              className="role-home-card tl-panel-card"
              title={
                <Space>
                  <ScheduleOutlined />
                  今日待办（按优先级）
                </Space>
              }
              extra={<Link to="/tasks">查看全部 <RightOutlined /></Link>}
            >
              <div className="tl-todo-list">
                {tlTodoGroups.map((group) => (
                  <div className="tl-todo-group" key={group.key}>
                    <div className={`tl-todo-summary tl-todo-summary--${group.tone}`}>
                      <span className="tl-todo-icon">{group.tone === "purple" ? <FileTextOutlined /> : <UploadOutlined />}</span>
                      <div>
                        <strong>{group.title}</strong>
                        <p>
                          <b>{group.count}</b>
                          <span>{group.key === "daily-review" ? " 份" : " 个"}</span>
                        </p>
                        <em>{group.subtitle}</em>
                      </div>
                    </div>
                    <div className="tl-todo-rows">
                      {group.rows.map((row) => (
                        <Link className="tl-todo-row" key={row.key} to={row.to}>
                          <span className="tl-todo-owner">
                            <Avatar size={24}>{row.owner.slice(0, 1)}</Avatar>
                            {row.owner}
                          </span>
                          <span>{row.title}</span>
                          {row.tag ? <Tag color="red">{row.tag}</Tag> : null}
                          <time>{row.time}</time>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card
              className="role-home-card tl-panel-card"
              title={
                <Space>
                  <TeamOutlined />
                  团队任务概览
                </Space>
              }
              extra={<Link to="/tasks">更多数据 <RightOutlined /></Link>}
            >
              <div className="tl-task-overview">
                <div className="tl-task-circle">
                  <Progress
                    type="circle"
                    percent={71}
                    size={126}
                    strokeColor={{ "0%": "#1677ff", "55%": "#52c41a", "100%": "#722ed1" }}
                    trailColor="#f0f3f7"
                    format={() => (
                      <span className="tl-task-circle__text">
                        <strong>18</strong>
                        <em>总任务</em>
                      </span>
                    )}
                  />
                </div>
                <div className="tl-task-status">
                  {tlTaskStatusItems.map((item) => (
                    <div key={item.label}>
                      <span style={{ backgroundColor: item.color }} />
                      <b>{item.label}</b>
                      <strong>{item.value}</strong>
                      <em>({item.percent})</em>
                    </div>
                  ))}
                </div>
                <div className="tl-task-kpis">
                  <div>
                    <span>按时完成率</span>
                    <strong className="is-green">71%</strong>
                    <em>较昨日 +5%</em>
                  </div>
                  <div>
                    <span>延期任务</span>
                    <strong className="is-red">2</strong>
                    <em>较昨日 -1</em>
                  </div>
                  <div>
                    <span>平均 Cycle Time</span>
                    <strong className="is-red">3.6 天</strong>
                    <em>较昨日 -0.4 天</em>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={12}>
            <Card
              className="role-home-card tl-panel-card"
              title={
                <Space>
                  <ClockCircleOutlined />
                  进行中任务（缺少工作证据）
                </Space>
              }
              extra={<span className="tl-card-extra">共 3 个 全部 <RightOutlined /></span>}
            >
              <Table<TLWorkEvidenceTask>
                className="tl-compact-table"
                size="small"
                rowKey="key"
                columns={evidenceColumns}
                dataSource={tlEvidenceTasks}
                pagination={false}
              />
              <p className="tl-table-note">说明：连续 2 天及以上无 Session 或工作记录</p>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card
              className="role-home-card tl-panel-card"
              title={
                <Space>
                  <ThunderboltOutlined />
                  最近动态
                </Space>
              }
              extra={
                <div className="tl-activity-tabs">
                  {["全部", "风险/阻塞", "日报", "任务", "需求", "全部动态"].map((item, index) => (
                    <span className={index === 0 ? "is-active" : ""} key={item}>
                      {item}
                    </span>
                  ))}
                  <RightOutlined />
                </div>
              }
            >
              <div className="tl-activity-list">
                {tlActivities.map((item) => (
                  <div className="tl-activity-item" key={item.key}>
                    <span className={`tl-activity-icon tl-activity-icon--${item.tone}`}>{activityIcon(item.tone)}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.desc}</p>
                    </div>
                    <time>{item.time}</time>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        <div className="tl-quick-action-grid">
          {tlQuickActions.map((item) => (
            <Link className={`tl-quick-action tl-quick-action--${item.tone}`} key={item.key} to={item.to}>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
            </Link>
          ))}
        </div>
      </div>
    </PagePanel>
  );
}

function PMHomepagePrototype() {
  const pmStatusColor = (value: string) => {
    if (value.includes("缺验收标准")) return "red";
    if (value === "需处理" || value.includes("风险") || value.includes("阻塞")) return "orange";
    if (value === "已介入") return "blue";
    if (value === "等待反馈") return "gold";
    if (value === "待处理") return "red";
    if (value === "待更新") return "orange";
    if (value === "进行中") return "blue";
    if (value.includes("异常")) return "volcano";
    if (value.includes("稳定")) return "green";
    if (value.includes("健康") || value.includes("无明显")) return "green";
    return "default";
  };
  const priorityColor = (value: PMActionItem["priority"]) => (value === "高" ? "red" : "orange");
  const progressStatus = (value: number) => (value < 45 ? "exception" : value >= 80 ? "success" : "active");
  const totalSessions = pmActiveRequirements.reduce((sum, item) => sum + item.weekSessions, 0);
  const totalTokenK = pmActiveRequirements.reduce((sum, item) => sum + Number(item.weekToken.replace("K", "")), 0);

  const requirementColumns: ColumnsType<PMActiveRequirement> = [
    {
      title: "需求",
      dataIndex: "name",
      width: 210,
      render: (name: string, row) => (
        <Space orientation="vertical" size={0}>
          <Link to={row.to}>
            {row.key} {name}
          </Link>
        </Space>
      )
    },
    {
      title: "关注来源",
      dataIndex: "focusSource",
      width: 110,
      render: (source: string) => source === "-" ? <Typography.Text type="secondary">-</Typography.Text> : <Tag color="blue">{source}</Tag>
    },
    { title: "AC", dataIndex: "ac", width: 80 },
    {
      title: "任务进度",
      dataIndex: "taskProgress",
      width: 150,
      render: (progress: number) => (
        <div className="pm-progress-cell">
          <Progress percent={progress} size="small" showInfo={false} status={progressStatus(progress)} />
          <span>{progress}%</span>
        </div>
      )
    },
    {
      title: "阻塞状态",
      dataIndex: "blockStatus",
      width: 130,
      render: (status: string) => <Tag color={pmStatusColor(status)}>{status}</Tag>
    },
    { title: "本周 Session", dataIndex: "weekSessions", width: 115 },
    { title: "本周 Token", dataIndex: "weekToken", width: 110 },
    { title: "Deadline", dataIndex: "deadline", width: 100 },
    {
      title: "操作",
      width: 120,
      render: (_, row) => (
        <Space size={8}>
          <Link to={row.to}>查看</Link>
          <span className="pm-action-separator">/</span>
          <a href={row.feishuUrl} target="_blank" rel="noreferrer">
            飞书
          </a>
        </Space>
      )
    }
  ];

  const taskColumns: ColumnsType<PMFollowTask> = [
    {
      title: "任务",
      dataIndex: "name",
      render: (name: string, row) => <Link to={row.to}>{name}</Link>
    },
    { title: "所属需求", dataIndex: "requirement", width: 100 },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (status: string) => <Tag color={pmStatusColor(status)}>{status}</Tag>
    },
    { title: "负责人", dataIndex: "owner", width: 120 },
    { title: "截止时间", dataIndex: "deadline", width: 95 },
    { title: "最近说明", dataIndex: "note" }
  ];

  return (
    <PagePanel title="首页" description="关键事项概览" breadcrumbs={[{ title: "Dashboard" }]} showNav={false}>
      <div className="role-home role-home--pm-prototype">
        <div className="pm-scope-bar">
          <div>
            <strong>PM 需求推进首页</strong>
            <span>当前范围：我负责 / 我关注 / 全部可见 · 时间范围：本周</span>
          </div>
          <Space className="pm-quick-actions" wrap>
            <Link to="/reports">生成 PM 周报</Link>
            <Link to="/reports">写日报</Link>
            <Link to="/sessions">上传我的 Session</Link>
          </Space>
        </div>

        <Card
          className="role-home-card role-home-card--primary pm-action-card"
          title={
            <Space>
              <AlertOutlined />
              待 PM 处理
            </Space>
          }
        >
          <div className="pm-action-list">
            {pmActionItems.map((item) => (
              <div className={`pm-action-item pm-action-item--${priorityColor(item.priority)}`} key={item.key}>
                <div className="pm-action-item__head">
                  <Tag color={priorityColor(item.priority)}>{item.priority}</Tag>
                  <Link to={item.to}>
                    {item.key} {item.requirement}
                  </Link>
                </div>
                <div className="pm-action-item__reason">{item.triggerReason}</div>
                <div className="pm-action-item__meta">
                  <span>状态：<Tag color={pmStatusColor(item.status)}>{item.status}</Tag></span>
                  <span>负责人：{item.owner}</span>
                  <span>截止：{item.deadline}</span>
                </div>
                <div className="pm-action-item__footer">
                  <span>{item.nextAction}</span>
                  <Link to={item.to}>{item.action}</Link>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          className="role-home-card role-home-card--primary pm-requirement-card"
          title={
            <Space>
              <ProjectOutlined />
              当前进行中需求
            </Space>
          }
        >
          <Table<PMActiveRequirement>
            className="pm-compact-table"
            size="small"
            rowKey="key"
            columns={requirementColumns}
            dataSource={pmActiveRequirements}
            pagination={false}
          />
        </Card>

        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} xl={12}>
            <Card
              className="role-home-card role-home-card--primary pm-task-card"
              title={
                <Space>
                  <CheckSquareOutlined />
                  关注的任务
                </Space>
              }
            >
              <Table<PMFollowTask>
                className="pm-compact-table"
                size="small"
                rowKey="key"
                columns={taskColumns}
                dataSource={pmFollowTasks}
                pagination={false}
              />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card
              className="role-home-card role-home-card--primary pm-ai-card"
              title={
                <Space>
                  <ThunderboltOutlined />
                  AI 工作量与进展信号
                </Space>
              }
              extra={<Typography.Text type="secondary">更新时间：刚刚</Typography.Text>}
            >
              <div className="pm-ai-summary">
                <div>
                  <span>本周 Session</span>
                  <strong>{totalSessions}</strong>
                  <em>较上周 +18%</em>
                </div>
                <div>
                  <span>本周 Token</span>
                  <strong>{totalTokenK}K</strong>
                  <em>较上周 +22%</em>
                </div>
                <div>
                  <span>高工作量低进展</span>
                  <strong>1</strong>
                  <em>需 PM 查看</em>
                </div>
              </div>
              <div className="pm-ai-alert">
                <AlertOutlined />
                <div>
                  <strong>REQ-037 本周 22 个 Session，但 AC 和任务状态 2 天无变化。</strong>
                  <span>AI 数据仅作为辅助信号，建议检查任务拆解或范围是否需要调整。</span>
                </div>
                <Link to="/requirements">查看摘要</Link>
              </div>
              <div className="pm-ai-link">
                <Link to="/sessions">查看工作信号详情 →</Link>
              </div>
            </Card>
          </Col>
        </Row>

      </div>
    </PagePanel>
  );
}

function DirectorHomepagePrototype() {
  const [range, setRange] = useState<DirectorTokenRange>("week");
  const [reqFilter, setReqFilter] = useState<DirectorReqFilter>("all");
  const [selectedRequirement, setSelectedRequirement] = useState<DirectorRequirementRow | null>(null);
  const [focusDrawerOpen, setFocusDrawerOpen] = useState(false);
  const [selectedFocusItem, setSelectedFocusItem] = useState<DirectorFocusItem | null>(null);
  const token = directorTokenData[range];
  const tokenSeries = token.points.map((value, index) => ({
    date: `2026-06-${String(index + 15).padStart(2, "0")}`,
    value
  }));
  const requirements =
    reqFilter === "focused"
      ? directorRequirements.filter((item) => item.focus === "重点关注")
      : reqFilter === "risk"
        ? directorRequirements.filter((item) => item.status === "风险/阻塞")
        : directorRequirements;
  const focusItemsByType = directorFocusItems.reduce<Record<DirectorFocusType, DirectorFocusItem[]>>(
    (groups, item) => {
      groups[item.type].push(item);
      return groups;
    },
    { 项目: [], 需求: [], 任务: [] }
  );

  const requirementColumns: ColumnsType<DirectorRequirementRow> = [
    {
      title: "需求",
      dataIndex: "name",
      render: (name: string, row) => (
        <Space orientation="vertical" size={0}>
          <Button type="link" size="small" onClick={() => setSelectedRequirement(row)}>
            {name}
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.key}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (status: string) => <Tag color={status === "风险/阻塞" ? "orange" : status === "已完成" ? "green" : "blue"}>{status}</Tag>
    },
    {
      title: "团队",
      dataIndex: "owner",
      width: 160
    },
    {
      title: "AC 完成",
      dataIndex: "ac",
      width: 80
    },
    {
      title: "进度",
      dataIndex: "progress",
      width: 150,
      render: (progress: number) => <Progress percent={progress} size="small" />
    },
    {
      title: "关注",
      dataIndex: "focus",
      width: 110,
      render: (focus: string) => <Tag color={focus === "重点关注" ? "gold" : "default"}>{focus}</Tag>
    },
    {
      title: "Deadline",
      dataIndex: "deadline",
      width: 100
    }
  ];

  return (
    <PagePanel
      title="首页"
      description="关键事项概览"
      breadcrumbs={[{ title: "Dashboard" }]}
      showNav={false}
    >
      <div className="role-home role-home--director">
        <Card className="role-home-card director-summary-card">
          <div className="director-summary-card__content">
            <div>
              <strong>部门状态摘要</strong>
              <p>
                部门整体运行正常；优先关注 REQ-005 安全加固专项，另有 2 条关注变化、1 条临近 deadline。
              </p>
            </div>
            <Button size="small" onClick={() => setFocusDrawerOpen(true)}>
              查看我的关注
            </Button>
          </div>
        </Card>

        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <StatCard
              label="进行中需求"
              value="12"
              sub="已完成 8"
              tone="info"
              icon={<ProjectOutlined />}
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="风险 / 阻塞需求"
              value="3"
              sub="跨团队 1"
              tone="warning"
              icon={<AlertOutlined />}
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="团队活跃率"
              value="88%"
              sub="37/42 活跃"
              tone="success"
              icon={<TeamOutlined />}
            />
          </Col>
          <Col xs={12} md={6}>
            <StatCard
              label="本周 Token"
              value={directorTokenData.week.total}
              sub="较上周 +8%"
              tone="primary"
              icon={<ThunderboltOutlined />}
            />
          </Col>
        </Row>

        <div className="director-requirement-row">
          <Card
            className="role-home-card role-home-card--primary director-main-card director-requirement-card"
            title={
              <Space>
                <ProjectOutlined />
                部门需求概览
              </Space>
            }
            extra={
              <Segmented
                size="small"
                value={reqFilter}
                onChange={(value) => setReqFilter(value as DirectorReqFilter)}
                options={[
                  { label: "全部需求", value: "all" },
                  { label: "重点关注", value: "focused" },
                  { label: "风险需求", value: "risk" }
                ]}
              />
            }
          >
            <div className="director-requirement-summary">
              <span className="director-health-chip director-health-chip--risk">风险 3</span>
              <span className="director-health-chip director-health-chip--focus">重点关注 2</span>
              <span className="director-health-chip director-health-chip--cross">跨团队 1</span>
              <span className="director-health-chip director-health-chip--deadline">临近 1</span>
            </div>
            <Table<DirectorRequirementRow>
              className="director-requirement-table"
              size="small"
              rowKey="key"
              columns={requirementColumns}
              dataSource={requirements}
              pagination={false}
            />
          </Card>
        </div>

        <div className="director-info-grid">
          <Card
            className="role-home-card director-compact-card"
            title={
              <Space>
                <FileTextOutlined />
                部门报告状态
              </Space>
            }
          >
            <div className="director-report-list">
              <div className="director-report-row">
                <div>
                  <strong>部门日报</strong>
                  <span>已生成 · 覆盖 3 队 · 今天 20:00</span>
                </div>
                <Link to="/reports">查看飞书</Link>
              </div>
              <div className="director-report-row">
                <div>
                  <strong>部门周报</strong>
                  <span>预计周五 17:00 · 最近：上周五 18:00</span>
                </div>
                <Link to="/reports">查看飞书</Link>
              </div>
            </div>
          </Card>
          <Card
            className="role-home-card director-compact-card director-focus-card"
            title={
              <Space>
                <FlagOutlined />
                我的关注动态
              </Space>
            }
            extra={
              <Button size="small" type="link" onClick={() => setFocusDrawerOpen(true)}>
                查看全部关注
              </Button>
            }
          >
            <div className="director-focus-mini">
              <div className="director-focus-mini__summary">8 项关注 · 2 条更新 · 1 条临近</div>
              <div className="director-focus-mini__changes">
                {directorFocusChanges.slice(0, 2).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSelectedFocusItem(
                        directorFocusItems.find((focusItem) => focusItem.key === item.key) ?? null
                      );
                      setFocusDrawerOpen(true);
                    }}
                  >
                    <Tag>{item.type}</Tag>
                    <span>{item.name}：{item.change}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="director-ops-grid">
          <Card
            className="role-home-card director-ops-card"
            title={
              <Space>
                <TeamOutlined />
                团队活跃度
              </Space>
            }
          >
            <div className="director-section-note">
              AI 工程活跃正常；推理加速日报待确认；模型训练本周 Session 稳定。
            </div>
            <div className="director-team-grid">
              {directorTeams.map((team) => (
                <div className="director-team-card" key={team.name}>
                  <div className="director-team-card__head">
                    <strong>{team.name}</strong>
                    <Tag color="blue">{team.reportStatus}</Tag>
                  </div>
                  <Progress percent={team.rate} size="small" />
                  <div className="director-team-card__meta">
                    <span>活跃人数 {team.active}</span>
                    <span>今日 Session {team.todaySessions}</span>
                    <span>本周 Session {team.weekSessions}</span>
                  </div>
                  <Link className="director-subtle-link" to="/organization">查看团队详情</Link>
                </div>
              ))}
            </div>
          </Card>
          <Card
            className="role-home-card director-ops-card"
            title={
              <Space>
                <ThunderboltOutlined />
                Token 趋势｜辅助分析
              </Space>
            }
            extra={
              <Segmented
                size="small"
                value={range}
                onChange={(value) => setRange(value as DirectorTokenRange)}
                options={[
                  { label: "日", value: "day" },
                  { label: "周", value: "week" },
                  { label: "月", value: "month" }
                ]}
              />
            }
          >
            <div className="director-token-panel">
              <div className="director-token-panel__summary">
                <div>
                  <span>总 Token</span>
                  <strong>{token.total}</strong>
                  <em>{token.change}</em>
                </div>
                <Link to="/tokens">查看 Token 详情</Link>
              </div>
              <Row gutter={[12, 12]}>
                <Col xs={24} lg={14}>
                  <TokenTrendChart series={tokenSeries} height={170} />
                </Col>
                <Col xs={24} lg={10}>
                  <TokenDistributionPie groups={token.models} centerLabel={token.total} height={170} />
                </Col>
              </Row>
            </div>
          </Card>
        </div>
      </div>

      <Drawer
        title={selectedRequirement?.name ?? "需求概览"}
        open={Boolean(selectedRequirement)}
        onClose={() => setSelectedRequirement(null)}
        size="default"
      >
        {selectedRequirement ? (
          <div className="director-drawer">
            <p>
              <strong>{selectedRequirement.key}</strong> · {selectedRequirement.status}
            </p>
            <p>团队：{selectedRequirement.owner}</p>
            <p>AC：{selectedRequirement.ac}</p>
            <p>进度：{selectedRequirement.progress}%</p>
            <p>关注：{selectedRequirement.focus}</p>
            <p>说明：这里展示需求概况，不包含完整需求管理操作。</p>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        title="我的关注"
        open={focusDrawerOpen}
        onClose={() => {
          setFocusDrawerOpen(false);
          setSelectedFocusItem(null);
        }}
        size="large"
      >
        <div className="director-focus-drawer">
          {(["项目", "需求", "任务"] as DirectorFocusType[]).map((type) => (
            <section className="director-focus-group" key={type}>
              <h3>{type}</h3>
              <div className="director-focus-list">
                {focusItemsByType[type].map((item) => (
                  <button
                    className={`director-focus-item ${selectedFocusItem?.key === item.key ? "is-selected" : ""}`}
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedFocusItem(item)}
                  >
                    <div className="director-focus-item__head">
                      <strong>{item.name}</strong>
                      <Tag color={item.risk === "是" ? "orange" : "default"}>风险：{item.risk}</Tag>
                    </div>
                    <div className="director-focus-item__meta">
                      <span>类型：{item.type}</span>
                      <span>状态：{item.status}</span>
                      <span>{item.relation}</span>
                    </div>
                    <p>{item.change}</p>
                    <em>{item.updatedAt}</em>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {selectedFocusItem ? (
            <section className="director-focus-detail">
              <strong>{selectedFocusItem.name}</strong>
              <p>{selectedFocusItem.type} · {selectedFocusItem.status} · {selectedFocusItem.relation}</p>
              <p>最近变化：{selectedFocusItem.change}</p>
              <p>是否有风险：{selectedFocusItem.risk}</p>
              <p>最近更新时间：{selectedFocusItem.updatedAt}</p>
            </section>
          ) : null}
        </div>
      </Drawer>
    </PagePanel>
  );
}

function ActionCard({ item, compact = false }: { item: ActionItem; compact?: boolean }) {
  return (
    <article className={`role-home-action role-home-action--${item.tone} ${compact ? "is-compact" : ""}`}>
      <div className="role-home-action__content">
        <div className="role-home-action__head">
          <strong>{item.title}</strong>
          <Tag color={tagColor(item.tone)}>{item.tag}</Tag>
        </div>
        <p>{item.desc}</p>
        <span>{item.meta}</span>
      </div>
      <Link className="role-home-action__link" to={item.to}>
        {item.action}
      </Link>
    </article>
  );
}

function tagColor(tone: Tone) {
  const colors: Record<Tone, string> = {
    blue: "blue",
    green: "green",
    orange: "orange",
    red: "red",
    purple: "purple",
    gray: "default"
  };
  return colors[tone];
}
