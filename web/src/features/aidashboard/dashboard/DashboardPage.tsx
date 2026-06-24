import {
  AlertOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FlagOutlined,
  LinkOutlined,
  RightOutlined,
  SendOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Badge, Button, Checkbox, Col, Input, Modal, Row, Segmented, Select, Space, Steps, Tag } from "antd";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

import "./console-dashboard.css";

type PreviewRole = "employee" | "team_leader" | "director" | "pm";
type ReportStatus = "待生成" | "生成中" | "草稿待确认" | "已发送" | "发送失败" | "生成失败";
type ReportGenerateMode = "系统自动生成" | "手动生成";
type ReportModalStep = "sessions" | "source" | "editor";
type ReportKind =
  | "personal_daily"
  | "personal_weekly"
  | "team_daily"
  | "team_weekly"
  | "department_daily"
  | "department_weekly";
type ReportScope = "personal" | "team" | "department";
type RiskTone = "red" | "orange" | "gold" | "blue";
type FollowType = "需求" | "任务";
type RiskType = "deadline" | "dependency_blocker";
type RiskRelatedObjectType = "requirement" | "task";
type TokenRange = "yesterday" | "last3days" | "last7days";
type SessionUploadStatus = "上报完整" | "有上报记录" | "暂无记录" | "解析异常";

interface FollowItem {
  key: string;
  type: FollowType;
  title: string;
  requirement?: string;
  requirementId: string;
  taskId?: string;
  owner: string;
  status: string;
  deadline: string;
  risk: string;
  dependency?: string;
  activity?: string;
}

interface RiskItem {
  key: string;
  riskType: RiskType;
  title: string;
  source: string;
  target: string;
  relatedObjectType: RiskRelatedObjectType;
  requirementId?: string;
  taskId?: string;
  owner: string;
  deadline: string;
  reason: string;
  level: "高" | "中" | "低";
  tone: RiskTone;
  actionText: string;
  targetUrl?: string;
}

interface ReportCoverage {
  expected: number;
  submitted: number;
  missing: number;
  failed: number;
}

interface ReportItem {
  id: string;
  kind: ReportKind;
  scope: ReportScope;
  name: string;
  status: ReportStatus;
  description: string;
  sourceSummary: string;
  sessionCount: number;
  generateMode: ReportGenerateMode;
  skill: string;
  updatedAt: string;
  nextAt?: string;
}

interface ConsoleRoleData {
  label: string;
  userLine: string;
  workCue: string;
  personalReports: ReportItem[];
  summaryReports?: ReportItem[];
  coverage: ReportCoverage;
  metrics: {
    focusCount: string;
    focusNote: string;
    riskCount: string;
    riskNote: string;
    dueCount: string;
    dueNote: string;
  };
  follows: FollowItem[];
  risks: RiskItem[];
}

interface TokenReport {
  total: string;
  sessions: number;
  uploaders?: number;
  bars: { label: string; value: number; text: string }[];
  groups?: { name: string; sessions: number; total: string; uploaders: number; value: number }[];
  mine?: { sessions: number; total: string };
  status: SessionUploadStatus;
}

interface TaskProgressSuggestion {
  key: string;
  taskName: string;
  progress: number;
  status: string;
  sessionIds: string[];
  note: string;
  syncState?: "已修改" | "待同步";
}

const ROLE_OPTIONS: { label: string; value: PreviewRole }[] = [
  { label: "个人", value: "employee" },
  { label: "TL", value: "team_leader" },
  { label: "总监", value: "director" },
  { label: "PM", value: "pm" }
];

const SESSION_OPTIONS = [
  {
    tool: "Claude Code session",
    timeRange: "09:30 - 10:20",
    summary: "控制台页面调整",
    value: "session-am",
    recommended: true
  },
  {
    tool: "Codex session",
    timeRange: "14:00 - 15:10",
    summary: "需求看板原型修改",
    value: "session-pm",
    recommended: true
  },
  {
    tool: "Claude Code session",
    timeRange: "17:30 - 18:00",
    summary: "日报流程讨论",
    value: "session-evening",
    recommended: false
  }
];

const TASK_PROGRESS_SUGGESTIONS: TaskProgressSuggestion[] = [
  {
    key: "task-console-daily-flow",
    taskName: "控制台日报交互设计",
    progress: 75,
    status: "进行中",
    sessionIds: ["session-am", "session-pm"],
    note: ""
  },
  {
    key: "task-daily-entry-state",
    taskName: "日报入口状态优化",
    progress: 25,
    status: "进行中",
    sessionIds: ["session-pm"],
    note: ""
  }
];

const TOKEN_RANGE_OPTIONS: { label: string; value: TokenRange }[] = [
  { label: "昨天", value: "yesterday" },
  { label: "近 3 天", value: "last3days" },
  { label: "近 7 天", value: "last7days" }
];

const TOKEN_DATA: Record<PreviewRole, Record<TokenRange, TokenReport>> = {
  employee: {
    yesterday: {
      total: "0.18M",
      sessions: 1,
      bars: [{ label: "06-22", value: 30, text: "1 session" }],
      status: "上报完整"
    },
    last3days: {
      total: "0.86M",
      sessions: 5,
      bars: [
        { label: "06-21", value: 42, text: "2 session" },
        { label: "06-22", value: 68, text: "2 session" },
        { label: "06-23", value: 25, text: "1 session" }
      ],
      status: "上报完整"
    },
    last7days: {
      total: "1.26M",
      sessions: 8,
      bars: [
        { label: "06-17", value: 18, text: "1 session" },
        { label: "06-19", value: 36, text: "2 session" },
        { label: "06-21", value: 42, text: "2 session" },
        { label: "06-22", value: 68, text: "2 session" },
        { label: "06-23", value: 25, text: "1 session" }
      ],
      status: "上报完整"
    }
  },
  pm: {
    yesterday: {
      total: "0.12M",
      sessions: 1,
      bars: [{ label: "06-22", value: 24, text: "1 session" }],
      status: "上报完整"
    },
    last3days: {
      total: "0.54M",
      sessions: 4,
      bars: [
        { label: "06-21", value: 28, text: "1 session" },
        { label: "06-22", value: 45, text: "2 session" },
        { label: "06-23", value: 20, text: "1 session" }
      ],
      status: "上报完整"
    },
    last7days: {
      total: "0.96M",
      sessions: 6,
      bars: [
        { label: "06-18", value: 18, text: "1 session" },
        { label: "06-20", value: 24, text: "1 session" },
        { label: "06-21", value: 28, text: "1 session" },
        { label: "06-22", value: 45, text: "2 session" },
        { label: "06-23", value: 20, text: "1 session" }
      ],
      status: "上报完整"
    }
  },
  team_leader: {
    yesterday: {
      total: "0.86M",
      sessions: 7,
      uploaders: 5,
      bars: [
        { label: "已上报成员", value: 52, text: "5 人" },
        { label: "session", value: 38, text: "7 个" },
        { label: "Token", value: 32, text: "0.86M" }
      ],
      mine: { sessions: 1, total: "0.18M" },
      status: "有上报记录"
    },
    last3days: {
      total: "5.28M",
      sessions: 36,
      uploaders: 9,
      bars: [
        { label: "已上报成员", value: 74, text: "9 人" },
        { label: "session", value: 86, text: "36 个" },
        { label: "Token", value: 64, text: "5.28M" }
      ],
      mine: { sessions: 5, total: "0.86M" },
      status: "有上报记录"
    },
    last7days: {
      total: "9.74M",
      sessions: 64,
      uploaders: 11,
      bars: [
        { label: "已上报成员", value: 90, text: "11 人" },
        { label: "session", value: 92, text: "64 个" },
        { label: "Token", value: 78, text: "9.74M" }
      ],
      mine: { sessions: 8, total: "1.26M" },
      status: "有上报记录"
    }
  },
  director: {
    yesterday: {
      total: "3.2M",
      sessions: 28,
      bars: [],
      groups: [
        { name: "芯片组", sessions: 9, total: "1.1M", uploaders: 4, value: 62 },
        { name: "后台组", sessions: 7, total: "0.8M", uploaders: 3, value: 48 },
        { name: "平台组", sessions: 6, total: "0.7M", uploaders: 3, value: 42 },
        { name: "模型组", sessions: 6, total: "0.6M", uploaders: 3, value: 44 }
      ],
      mine: { sessions: 1, total: "0.18M" },
      status: "有上报记录"
    },
    last3days: {
      total: "18.6M",
      sessions: 142,
      bars: [],
      groups: [
        { name: "芯片组", sessions: 42, total: "6.8M", uploaders: 12, value: 86 },
        { name: "后台组", sessions: 31, total: "4.2M", uploaders: 8, value: 64 },
        { name: "平台组", sessions: 28, total: "3.6M", uploaders: 7, value: 58 },
        { name: "模型组", sessions: 41, total: "4.0M", uploaders: 10, value: 70 }
      ],
      mine: { sessions: 5, total: "0.86M" },
      status: "有上报记录"
    },
    last7days: {
      total: "34.2M",
      sessions: 261,
      bars: [],
      groups: [
        { name: "芯片组", sessions: 78, total: "12.4M", uploaders: 14, value: 90 },
        { name: "后台组", sessions: 58, total: "7.9M", uploaders: 10, value: 68 },
        { name: "平台组", sessions: 52, total: "6.4M", uploaders: 9, value: 60 },
        { name: "模型组", sessions: 73, total: "7.5M", uploaders: 12, value: 74 }
      ],
      mine: { sessions: 8, total: "1.26M" },
      status: "有上报记录"
    }
  }
};

const DEFAULT_MARKDOWN = `# 6 月 22 日日报

## 今日完成
* 收敛控制台首页信息架构，移除大盘式概览。
* 将日报生成入口调整为个人 session 生成个人日报。
* 梳理风险项、我关注的、日报 / 周报入口的页面层级。

## 风险与阻塞
* 飞书发送目标仍需确认，P0 先保留站内保存兜底。
* 需求看板尚未进入原型设计，风险定位入口暂为占位。

## 明日计划
* 继续完善控制台日报生成弹窗和 Markdown 编辑流程。
* 对齐需求看板定位规则。`;

function createReport(overrides: Omit<ReportItem, "sessionCount" | "generateMode" | "skill" | "updatedAt"> & Partial<ReportItem>): ReportItem {
  return {
    sessionCount: 0,
    generateMode: "系统自动生成",
    skill: "默认日报 Skill",
    updatedAt: "-",
    ...overrides
  };
}

const ROLE_DATA: Record<PreviewRole, ConsoleRoleData> = {
  employee: {
    label: "个人",
    userLine: "陈一 · 前端工程师",
    workCue: "今天有 1 个阻塞任务，日报还没有发送。",
    personalReports: [
      createReport({
        id: "employee-personal-daily",
        kind: "personal_daily",
        scope: "personal",
        name: "今日日报",
        status: "草稿待确认",
        description: "系统已根据今日 session 生成日报，请确认后发送。",
        sourceSummary: "个人当日 session + 用户当天相关任务/需求状态",
        sessionCount: 2,
        updatedAt: "18:42",
        nextAt: "19:00"
      }),
      createReport({
        id: "employee-personal-weekly",
        kind: "personal_weekly",
        scope: "personal",
        name: "本周周报",
        status: "待生成",
        description: "本周周报尚未生成，可基于本周日报和任务记录生成草稿。",
        sourceSummary: "本周个人日报、个人 session 摘要、我负责的任务、我关注的任务、风险与阻塞",
        updatedAt: "-"
      })
    ],
    coverage: { expected: 1, submitted: 0, missing: 1, failed: 0 },
    metrics: {
      focusCount: "4",
      focusNote: "我负责或主动关注的任务",
      riskCount: "3",
      riskNote: "1 个阻塞，2 个临期",
      dueCount: "2",
      dueNote: "48 小时内到期"
    },
    follows: [
      {
        key: "employee-task-1",
        type: "任务",
        title: "补充日报生成验收标准",
        requirement: "AI 日报生成",
        requirementId: "req-ai-daily",
        taskId: "task-daily-ac",
        owner: "我",
        status: "进行中",
        deadline: "明天",
        dependency: "无阻塞依赖",
        risk: "临期",
        activity: "验收口径刚更新"
      },
      {
        key: "employee-task-2",
        type: "任务",
        title: "飞书发送联调",
        requirement: "日报发送",
        requirementId: "req-daily-send",
        taskId: "task-feishu-integration",
        owner: "我",
        status: "阻塞",
        deadline: "2026-06-25",
        dependency: "依赖：发送目标确认",
        risk: "依赖阻塞",
        activity: "上游任务已超期"
      },
      {
        key: "employee-task-3",
        type: "任务",
        title: "整理 session 解析异常样例",
        requirement: "Session 导入",
        requirementId: "req-session-import",
        taskId: "task-session-samples",
        owner: "我",
        status: "未开始",
        deadline: "2026-06-28",
        dependency: "依赖：解析规则确认",
        risk: "依赖未完成",
        activity: "等待样例补充"
      }
    ],
    risks: [
      {
        key: "employee-risk-1",
        riskType: "dependency_blocker",
        title: "飞书发送联调等待上游任务完成",
        source: "依赖阻塞",
        target: "日报发送 / 飞书发送联调",
        relatedObjectType: "task",
        requirementId: "req-daily-send",
        taskId: "task-feishu-integration",
        owner: "我",
        deadline: "2026-06-25",
        reason: "上游任务「发送目标确认」已超期",
        level: "高",
        tone: "red",
        actionText: "查看依赖",
        targetUrl: "/requirements?requirementId=req-daily-send&taskId=task-feishu-integration&focus=dependency"
      },
      {
        key: "employee-risk-2",
        riskType: "deadline",
        title: "日报生成验收标准明天到期",
        source: "临期",
        target: "AI 日报生成 / 补充验收标准",
        relatedObjectType: "task",
        requirementId: "req-ai-daily",
        taskId: "task-daily-ac",
        owner: "我",
        deadline: "明天",
        reason: "任务未完成，deadline 将在 48 小时内到期",
        level: "中",
        tone: "orange",
        actionText: "查看任务",
        targetUrl: "/requirements?requirementId=req-ai-daily&taskId=task-daily-ac&focus=deadline"
      }
    ]
  },
  team_leader: {
    label: "TL",
    userLine: "李雷 · Aida 前端组 TL",
    workCue: "组内 2 人日报未提交，1 个阻塞任务影响下游。",
    personalReports: [
      createReport({
        id: "tl-personal-daily",
        kind: "personal_daily",
        scope: "personal",
        name: "今日日报",
        status: "草稿待确认",
        description: "系统已根据今日 session 生成日报，请确认后发送。",
        sourceSummary: "个人当日 session + 用户当天相关任务/需求状态",
        sessionCount: 2,
        updatedAt: "18:30",
        nextAt: "19:00"
      }),
      createReport({
        id: "tl-personal-weekly",
        kind: "personal_weekly",
        scope: "personal",
        name: "本周周报",
        status: "草稿待确认",
        description: "系统已根据本周日报和任务记录生成周报草稿，请确认后发送。",
        sourceSummary: "本周个人日报、个人 session 摘要、我负责的任务、我关注的任务、风险与阻塞",
        updatedAt: "17:40"
      })
    ],
    summaryReports: [
      createReport({
        id: "tl-team-daily",
        kind: "team_daily",
        scope: "team",
        name: "今日组日报",
        status: "生成失败",
        description: "组日报生成失败，需要查看成员提交情况后重新生成。",
        sourceSummary: "组内成员今日日报、组内需求/任务状态、风险项、阻塞任务、临近 deadline 事项",
        updatedAt: "18:15"
      }),
      createReport({
        id: "tl-team-weekly",
        kind: "team_weekly",
        scope: "team",
        name: "本周组周报",
        status: "待生成",
        description: "可基于组内成员本周报告和需求看板数据生成组周报草稿。",
        sourceSummary: "组内成员本周个人日报、个人周报、需求看板数据、本周风险与阻塞、完成/延期/下周计划",
        updatedAt: "-"
      })
    ],
    coverage: { expected: 8, submitted: 6, missing: 2, failed: 0 },
    metrics: {
      focusCount: "11",
      focusNote: "5 个需求，6 个任务",
      riskCount: "7",
      riskNote: "3 个阻塞，2 个超期",
      dueCount: "5",
      dueNote: "本周到期任务"
    },
    follows: [
      {
        key: "tl-req-1",
        type: "需求",
        title: "AI 日报生成",
        requirementId: "req-ai-daily",
        owner: "李雷",
        status: "进行中",
        deadline: "2026-06-30",
        dependency: "2 个强依赖",
        risk: "依赖阻塞",
        activity: "任务进度 62%"
      },
      {
        key: "tl-task-1",
        type: "任务",
        title: "解析 Claude Code session",
        requirement: "Session 导入",
        requirementId: "req-session-import",
        taskId: "task-session-parser",
        owner: "韩梅梅",
        status: "阻塞",
        deadline: "2026-06-24",
        dependency: "依赖：字段冻结",
        risk: "已超期",
        activity: "影响导入联调"
      },
      {
        key: "tl-task-2",
        type: "任务",
        title: "日报草稿编辑态",
        requirement: "AI 日报生成",
        requirementId: "req-ai-daily",
        taskId: "task-daily-editor",
        owner: "王强",
        status: "进行中",
        deadline: "2026-06-27",
        dependency: "依赖：默认 Skill 输出",
        risk: "临期",
        activity: "草稿保存待确认"
      }
    ],
    risks: [
      {
        key: "tl-risk-1",
        riskType: "deadline",
        title: "本组有 2 个任务已超过 deadline",
        source: "已超期",
        target: "Session 导入 / 解析 Claude Code session",
        relatedObjectType: "task",
        requirementId: "req-session-import",
        taskId: "task-session-parser",
        owner: "韩梅梅",
        deadline: "2026-06-24",
        reason: "影响需求：Session 导入、需求看板原型",
        level: "高",
        tone: "red",
        actionText: "查看任务",
        targetUrl: "/requirements?requirementId=req-session-import&taskId=task-session-parser&focus=deadline"
      },
      {
        key: "tl-risk-2",
        riskType: "dependency_blocker",
        title: "日报发送联调等待接口任务完成",
        source: "依赖阻塞",
        target: "日报发送 / 飞书发送联调",
        relatedObjectType: "task",
        requirementId: "req-daily-send",
        taskId: "task-feishu-integration",
        owner: "李雷",
        deadline: "2026-06-25",
        reason: "上游发送接口任务已超期，影响当前联调任务",
        level: "高",
        tone: "red",
        actionText: "查看依赖",
        targetUrl: "/requirements?requirementId=req-daily-send&taskId=task-feishu-integration&focus=dependency"
      }
    ]
  },
  director: {
    label: "总监",
    userLine: "赵敏 · 研发总监",
    workCue: "部门日报提交率 78%，4 个高优先级风险需要下钻。",
    personalReports: [
      createReport({
        id: "director-personal-daily",
        kind: "personal_daily",
        scope: "personal",
        name: "今日日报",
        status: "已发送",
        description: "今日日报已发送。",
        sourceSummary: "个人当日 session + 用户当天相关任务/需求状态",
        sessionCount: 1,
        updatedAt: "17:55"
      }),
      createReport({
        id: "director-personal-weekly",
        kind: "personal_weekly",
        scope: "personal",
        name: "本周周报",
        status: "草稿待确认",
        description: "系统已根据本周日报和任务记录生成周报草稿，请确认后发送。",
        sourceSummary: "本周个人日报、个人 session 摘要、我负责的任务、我关注的任务、风险与阻塞",
        updatedAt: "17:20"
      })
    ],
    summaryReports: [
      createReport({
        id: "director-department-daily",
        kind: "department_daily",
        scope: "department",
        name: "今日部门日报",
        status: "发送失败",
        description: "部门日报发送失败，请重试或检查发送目标。",
        sourceSummary: "各组日报、各组提交情况、部门重点需求、高优先级风险、跨组依赖和阻塞",
        updatedAt: "18:05"
      }),
      createReport({
        id: "director-department-weekly",
        kind: "department_weekly",
        scope: "department",
        name: "本周部门周报",
        status: "待生成",
        description: "可基于各组周报和部门重点需求风险生成部门周报草稿。",
        sourceSummary: "各组周报、各组日报摘要、部门重点需求状态、高风险事项、资源/依赖/交付风险",
        updatedAt: "-"
      })
    ],
    coverage: { expected: 32, submitted: 25, missing: 6, failed: 1 },
    metrics: {
      focusCount: "16",
      focusNote: "重点需求",
      riskCount: "12",
      riskNote: "4 个高优先级",
      dueCount: "6",
      dueNote: "本周关键交付"
    },
    follows: [
      {
        key: "director-req-1",
        type: "需求",
        title: "AI 日报生成",
        requirementId: "req-ai-daily",
        owner: "李雷",
        status: "进行中",
        deadline: "2026-06-30",
        dependency: "2 个强依赖",
        risk: "依赖阻塞",
        activity: "关注需求，进度 62%"
      },
      {
        key: "director-req-2",
        type: "需求",
        title: "需求任务树重构",
        requirementId: "req-task-tree",
        owner: "周芷若",
        status: "进行中",
        deadline: "2026-07-05",
        dependency: "依赖：详情抽屉保存",
        risk: "已超期",
        activity: "关注需求，2 个任务延期"
      },
      {
        key: "director-req-3",
        type: "需求",
        title: "日报发送兜底方案",
        requirementId: "req-daily-fallback",
        owner: "王强",
        status: "未开始",
        deadline: "2026-07-10",
        dependency: "依赖：飞书目标确认",
        risk: "目标待定",
        activity: "关注需求，等待范围确认"
      }
    ],
    risks: [
      {
        key: "director-risk-1",
        riskType: "dependency_blocker",
        title: "关注需求「AI 日报生成」存在依赖阻塞",
        source: "依赖阻塞",
        target: "AI 日报生成",
        relatedObjectType: "requirement",
        requirementId: "req-ai-daily",
        owner: "李雷",
        deadline: "2026-06-30",
        reason: "影响任务：日报发送联调",
        level: "高",
        tone: "red",
        actionText: "查看依赖",
        targetUrl: "/requirements?requirementId=req-ai-daily&taskId=task-daily-send&focus=dependency"
      },
      {
        key: "director-risk-2",
        riskType: "deadline",
        title: "关注需求「需求任务树重构」存在延期风险",
        source: "已超期",
        target: "需求任务树重构",
        relatedObjectType: "requirement",
        requirementId: "req-task-tree",
        owner: "周芷若",
        deadline: "昨天",
        reason: "影响：2 个任务已超期",
        level: "高",
        tone: "red",
        actionText: "查看需求",
        targetUrl: "/requirements?requirementId=req-task-tree&focus=deadline"
      }
    ]
  },
  pm: {
    label: "PM",
    userLine: "周芷若 · 平台 PM",
    workCue: "2 个需求缺少 AC，日报发送目标仍待确认。",
    personalReports: [
      createReport({
        id: "pm-personal-daily",
        kind: "personal_daily",
        scope: "personal",
        name: "今日日报",
        status: "待生成",
        description: "今日尚未生成日报，可选择 session 生成日报。",
        sourceSummary: "个人当日 session + 用户当天相关任务/需求状态",
        updatedAt: "-"
      }),
      createReport({
        id: "pm-personal-weekly",
        kind: "personal_weekly",
        scope: "personal",
        name: "本周周报",
        status: "待生成",
        description: "本周周报尚未生成，可基于本周日报和任务记录生成草稿。",
        sourceSummary: "本周个人日报、个人 session 摘要、我负责的任务、我关注的任务、风险与阻塞",
        updatedAt: "-"
      })
    ],
    coverage: { expected: 1, submitted: 0, missing: 1, failed: 0 },
    metrics: {
      focusCount: "7",
      focusNote: "我关注的需求",
      riskCount: "5",
      riskNote: "2 个临期，1 个依赖",
      dueCount: "3",
      dueNote: "本周需求节点"
    },
    follows: [
      {
        key: "pm-req-1",
        type: "需求",
        title: "AI 日报生成",
        requirementId: "req-ai-daily",
        owner: "李雷",
        status: "进行中",
        deadline: "2026-06-30",
        dependency: "2 个强依赖",
        risk: "关键任务临期",
        activity: "需求进度 62%"
      },
      {
        key: "pm-req-2",
        type: "需求",
        title: "日报发送",
        requirementId: "req-daily-send",
        owner: "王强",
        status: "未开始",
        deadline: "2026-07-10",
        dependency: "依赖：发送目标确认",
        risk: "依赖待确认",
        activity: "需求尚未拆完"
      },
      {
        key: "pm-task-1",
        type: "任务",
        title: "补齐验收标准模板",
        requirement: "AI 日报生成",
        requirementId: "req-ai-daily",
        taskId: "task-ac-template",
        owner: "韩梅梅",
        status: "进行中",
        deadline: "2026-06-26",
        dependency: "无阻塞依赖",
        risk: "临期",
        activity: "模板评审待完成"
      }
    ],
    risks: [
      {
        key: "pm-risk-1",
        riskType: "dependency_blocker",
        title: "AI 日报生成存在依赖阻塞任务",
        source: "依赖阻塞",
        target: "AI 日报生成 / 飞书发送联调",
        relatedObjectType: "requirement",
        requirementId: "req-ai-daily",
        taskId: "task-feishu-integration",
        owner: "李雷",
        deadline: "2026-06-30",
        reason: "影响：日报发送联调",
        level: "高",
        tone: "red",
        actionText: "查看依赖",
        targetUrl: "/requirements?requirementId=req-ai-daily&taskId=task-feishu-integration&focus=dependency"
      },
      {
        key: "pm-risk-2",
        riskType: "deadline",
        title: "AI 日报生成存在关键任务临期",
        source: "临期",
        target: "AI 日报生成 / 补齐验收标准模板",
        relatedObjectType: "requirement",
        requirementId: "req-ai-daily",
        taskId: "task-ac-template",
        owner: "韩梅梅",
        deadline: "2026-06-26",
        reason: "关键任务「补齐验收标准模板」将在 48 小时内到期",
        level: "中",
        tone: "orange",
        actionText: "查看需求",
        targetUrl: "/requirements?requirementId=req-ai-daily&view=risks"
      }
    ]
  }
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [previewRole, setPreviewRole] = useState<PreviewRole>("employee");
  const [reportStateById, setReportStateById] = useState<Record<string, ReportItem>>(() =>
    Object.fromEntries(
      Object.values(ROLE_DATA)
        .flatMap((roleData) => [...roleData.personalReports, ...(roleData.summaryReports ?? [])])
        .map((reportItem) => [reportItem.id, reportItem])
    )
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalStep, setReportModalStep] = useState<ReportModalStep>("sessions");
  const [activeReportId, setActiveReportId] = useState<string>("employee-personal-daily");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(["session-am", "session-pm"]);
  const [draftMarkdown, setDraftMarkdown] = useState(DEFAULT_MARKDOWN);
  const [taskSuggestions, setTaskSuggestions] = useState<TaskProgressSuggestion[]>(TASK_PROGRESS_SUGGESTIONS);
  const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
  const [editingTaskDraft, setEditingTaskDraft] = useState<TaskProgressSuggestion | null>(null);
  const [tokenRange, setTokenRange] = useState<TokenRange>("last3days");
  const data = useMemo(() => ROLE_DATA[previewRole], [previewRole]);
  const personalReports = data.personalReports.map((reportItem) => reportStateById[reportItem.id] ?? reportItem);
  const summaryReports = (data.summaryReports ?? []).map((reportItem) => reportStateById[reportItem.id] ?? reportItem);
  const dailyReport = personalReports.find((reportItem) => reportItem.kind === "personal_daily") ?? personalReports[0];
  const activeReport = reportStateById[activeReportId] ?? dailyReport;
  const tokenReport = TOKEN_DATA[previewRole][tokenRange];
  const modifiedTaskCount = taskSuggestions.filter((task) => task.syncState === "待同步").length;

  const updateReport = (reportId: string, next: Partial<ReportItem>) => {
    setReportStateById((current) => ({
      ...current,
      [reportId]: {
        ...current[reportId],
        ...next
      }
    }));
  };

  const openReportModal = (reportItem: ReportItem, step?: ReportModalStep) => {
    setSelectedSessionIds(selectedSessionIds.length > 0 ? selectedSessionIds : ["session-am", "session-pm"]);
    setActiveReportId(reportItem.id);
    setDraftMarkdown(getDefaultDraftMarkdown(reportItem));
    setReportModalStep(step ?? getInitialReportModalStep(reportItem));
    setIsReportModalOpen(true);
  };

  const startGenerateDraft = () => {
    if (!activeReport) return;

    updateReport(activeReport.id, {
      status: "草稿待确认",
      sessionCount: activeReport.kind === "personal_daily" ? selectedSessionIds.length : activeReport.sessionCount,
      generateMode: activeReport.kind === "personal_daily" ? "手动生成" : "系统自动生成",
      skill: "默认日报 Skill",
      updatedAt: "刚刚",
      nextAt: activeReport.kind === "personal_daily" ? "19:00" : undefined
    });
    setReportModalStep("editor");
  };

  const saveDraft = () => {
    if (!activeReport) return;
    updateReport(activeReport.id, { status: "草稿待确认", updatedAt: "刚刚" });
  };

  const sendReport = () => {
    if (!activeReport) return;
    updateReport(activeReport.id, { status: "已发送", updatedAt: "刚刚" });
    setIsReportModalOpen(false);
  };

  const openTaskEditModal = (task: TaskProgressSuggestion) => {
    setEditingTaskKey(task.key);
    setEditingTaskDraft({ ...task });
  };

  const saveTaskEdit = () => {
    if (!editingTaskKey || !editingTaskDraft) return;

    setTaskSuggestions((current) =>
      current.map((task) =>
        task.key === editingTaskKey
          ? {
              ...editingTaskDraft,
              syncState: "待同步"
            }
          : task
      )
    );
    setEditingTaskKey(null);
    setEditingTaskDraft(null);
  };

  const handleRiskAction = (risk: RiskItem) => {
    if (risk.targetUrl) {
      navigate(risk.targetUrl);
    }
  };

  const handleFollowAction = (item: FollowItem) => {
    const targetUrl =
      item.type === "任务" && item.taskId
        ? `/requirements?requirementId=${item.requirementId}&taskId=${item.taskId}`
        : `/requirements?requirementId=${item.requirementId}`;
    navigate(targetUrl);
  };

  return (
    <PagePanel
      className="console-dashboard-page"
      bodyClassName="console-dashboard-page__body"
      title="控制台"
      description="查看报告状态、关注对象和需要处理的风险。"
      showNav={false}
    >
      <section className="console-dashboard">
        <div className="console-prototype-bar">
          <span>原型角色</span>
          <Segmented
            size="small"
            options={ROLE_OPTIONS}
            value={previewRole}
            onChange={(value) => setPreviewRole(value as PreviewRole)}
          />
        </div>

        <Row className="console-dashboard-hero-row" gutter={[14, 14]} align="stretch">
          <Col className="console-dashboard-hero-row__report" xs={24} xl={12}>
            <ReportSection
              title="今日报告"
              icon={<FileTextOutlined />}
              reports={personalReports}
              variant="personal"
              onOpen={openReportModal}
              onViewReports={() => navigate("/reports")}
              onSend={(reportItem) => {
                setActiveReportId(reportItem.id);
                updateReport(reportItem.id, { status: "已发送", updatedAt: "刚刚" });
              }}
            />
          </Col>
          <Col className="console-dashboard-hero-row__token" xs={24} xl={12}>
            <div className="console-report-status-card">
              {summaryReports.length > 0 ? (
              <ReportSection
                title={previewRole === "team_leader" ? "组报告" : "部门报告"}
                icon={<TeamOutlined />}
                reports={summaryReports}
                variant="summary"
                onOpen={openReportModal}
                onViewReports={() => navigate("/reports")}
                onSend={(reportItem) => {
                  setActiveReportId(reportItem.id);
                  updateReport(reportItem.id, { status: "已发送", updatedAt: "刚刚" });
                }}
              />
              ) : null}
              <SessionUploadCard
                range={tokenRange}
                report={tokenReport}
                onRangeChange={setTokenRange}
                onViewDetail={() => navigate("/tokens")}
              />
            </div>
          </Col>
        </Row>

        <div className="console-panel">
          <PanelHeader
            icon={<AlertOutlined />}
            title={`待处理风险 ${data.risks.length}`}
          />
          <div className="console-risk-list">
            {data.risks.length > 0 ? (
              <>
                <div className="console-risk-list__head">
                  <span>风险</span>
                  <span>标题 / 原因</span>
                  <span>影响对象</span>
                  <span>负责人</span>
                  <span>截止</span>
                  <span>操作</span>
                </div>
                {sortRisks(data.risks).map((item) => (
                  <RiskCard key={item.key} item={item} onAction={handleRiskAction} />
                ))}
              </>
            ) : (
              <div className="console-report-status-card">
                <p>暂无需要关注的风险</p>
                <Button type="link" onClick={() => navigate("/requirements")}>查看需求看板</Button>
              </div>
            )}
          </div>
        </div>

        <div className="console-panel">
          <PanelHeader
            icon={<FlagOutlined />}
            title="关注对象变化"
            extra={<Tag>{data.follows.length} 条</Tag>}
          />
          <div className="console-follow-list">
            <div className="console-follow-list__head">
              <span>对象 / 状态</span>
              <span>标题 / 所属</span>
              <span>负责人</span>
              <span>截止</span>
              <span>变化 / 提醒</span>
              <span>操作</span>
            </div>
            {sortFollowItems(data.follows).map((item) => (
              <FollowCard key={item.key} item={item} onView={handleFollowAction} />
            ))}
          </div>
        </div>
      </section>

      <Modal
        title={getReportModalTitle(activeReport, reportModalStep)}
        open={isReportModalOpen}
        width={reportModalStep === "editor" ? 860 : 720}
        footer={renderReportModalFooter({
          step: reportModalStep,
          report: activeReport,
          selectedCount: selectedSessionIds.length,
          modifiedTaskCount,
          onCancel: () => setIsReportModalOpen(false),
          onNext: startGenerateDraft,
          onGenerate: startGenerateDraft,
          onSave: saveDraft,
          onSend: sendReport
        })}
        onCancel={() => setIsReportModalOpen(false)}
      >
        <ReportModalContent
          step={reportModalStep}
          report={activeReport}
          coverage={data.coverage}
          selectedSessionIds={selectedSessionIds}
          taskSuggestions={taskSuggestions}
          draftMarkdown={draftMarkdown}
          onSelectedSessionIdsChange={setSelectedSessionIds}
          onEditTask={openTaskEditModal}
          onDraftMarkdownChange={setDraftMarkdown}
        />
      </Modal>
      <TaskProgressEditModal
        task={editingTaskDraft}
        open={Boolean(editingTaskDraft)}
        onCancel={() => {
          setEditingTaskKey(null);
          setEditingTaskDraft(null);
        }}
        onChange={setEditingTaskDraft}
        onSave={saveTaskEdit}
      />
    </PagePanel>
  );
}

function PanelHeader({ icon, title, extra }: { icon: ReactNode; title: string; extra?: ReactNode }) {
  return (
    <div className="console-panel__header">
      <div>
        <span className="console-panel__icon">{icon}</span>
        <strong>{title}</strong>
      </div>
      {extra}
    </div>
  );
}

function ReportSection({
  title,
  icon,
  reports,
  variant,
  onOpen,
  onViewReports,
  onSend
}: {
  title: string;
  icon: ReactNode;
  reports: ReportItem[];
  variant: "personal" | "summary";
  onOpen: (report: ReportItem, step?: ReportModalStep) => void;
  onViewReports: () => void;
  onSend: (report: ReportItem) => void;
}) {
  if (variant === "personal") {
    const dailyReport = reports.find((report) => report.kind === "personal_daily") ?? reports[0];
    const weeklyReport = reports.find((report) => report.kind === "personal_weekly");

    return (
      <div className="console-panel console-panel--daily">
        <PanelHeader icon={icon} title={title} />
        <div className="console-report-status-card">
          <div className="console-report-card-head">
            <Space size={8} wrap>
              <strong>{dailyReport.name}</strong>
              <ReportStatusTag status={dailyReport.status} />
            </Space>
            <div className="console-report-actions console-report-actions--head">
              {renderPrimaryReportAction(dailyReport, onOpen, onSend)}
            </div>
          </div>
          <p>{getDailyReportCopy(dailyReport)}</p>
          {weeklyReport ? (
            <div className="console-report-history">
              <span>{weeklyReport.name}</span>
              <ReportStatusTag status={weeklyReport.status} />
              <span>{getWeeklyReportReminder(weeklyReport)}</span>
              {renderWeeklyReportAction(weeklyReport, onOpen)}
            </div>
          ) : null}
          <div className="console-report-shortcuts" aria-label="报告入口">
            <button type="button" className="console-report-shortcut" onClick={onViewReports}>
              <span>
                <FileTextOutlined />
                <strong>日报记录</strong>
              </span>
              <em>确认与发送记录</em>
              <RightOutlined />
            </button>
            <button type="button" className="console-report-shortcut" onClick={onViewReports}>
              <span>
                <FileDoneOutlined />
                <strong>周报记录</strong>
              </span>
              <em>本周汇总与历史周报</em>
              <RightOutlined />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="console-panel console-panel--daily">
      <PanelHeader icon={icon} title={title} />
      <div className="console-report-status-card">
        {reports.map((report) => (
          <div key={report.id} className="console-report-status-card">
            <Space size={8} wrap>
              <strong>{report.name}</strong>
              <ReportStatusTag status={report.status} />
            </Space>
            <p>{report.description}</p>
            <div className="console-report-actions">{renderReportActions(report, onOpen, onSend)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderReportActions(
  report: ReportItem,
  onOpen: (report: ReportItem, step?: ReportModalStep) => void,
  onSend: (report: ReportItem) => void
) {
  if (report.status === "待生成") {
    return (
      <Button type="primary" icon={<FileDoneOutlined />} onClick={() => onOpen(report, getGenerateStepForReport(report))}>
        生成报告
      </Button>
    );
  }

  if (report.status === "生成中") {
    return <Button disabled>生成中</Button>;
  }

  if (report.status === "生成失败") {
    return (
      <Button type="primary" icon={<FileDoneOutlined />} onClick={() => onOpen(report, getGenerateStepForReport(report))}>
        重新生成
      </Button>
    );
  }

  if (report.status === "草稿待确认") {
    return (
      <>
        <Button icon={<EditOutlined />} onClick={() => onOpen(report, "editor")}>
          查看草稿
        </Button>
        <Button icon={<SendOutlined />} onClick={() => onSend(report)}>
          发送
        </Button>
      </>
    );
  }

  if (report.status === "已发送") {
    return (
      <Button icon={<EditOutlined />} onClick={() => onOpen(report, "editor")}>
        查看报告
      </Button>
    );
  }

  return (
    <>
      <Button type="primary" icon={<SendOutlined />} onClick={() => onSend(report)}>
        重试发送
      </Button>
      <Button icon={<EditOutlined />} onClick={() => onOpen(report, "editor")}>
        查看草稿
      </Button>
    </>
  );
}

function renderPrimaryReportAction(
  report: ReportItem,
  onOpen: (report: ReportItem, step?: ReportModalStep) => void,
  onSend: (report: ReportItem) => void
) {
  if (report.status === "生成中") {
    return (
      <Button className="console-report-primary-action console-report-primary-action--loading" disabled>
        生成中
      </Button>
    );
  }

  if (report.status === "草稿待确认") {
    return (
      <Button
        className="console-report-primary-action console-report-primary-action--confirm"
        type="primary"
        icon={<EditOutlined />}
        onClick={() => onOpen(report, "editor")}
      >
        确认日报
      </Button>
    );
  }

  if (report.status === "已发送") {
    return (
      <Button
        className="console-report-primary-action console-report-primary-action--quiet"
        icon={<EditOutlined />}
        onClick={() => onOpen(report, "editor")}
      >
        查看日报
      </Button>
    );
  }

  if (report.status === "发送失败") {
    return (
      <Button
        className="console-report-primary-action console-report-primary-action--retry"
        type="primary"
        icon={<SendOutlined />}
        onClick={() => onSend(report)}
      >
        重试发送
      </Button>
    );
  }

  return (
    <Button
      className={`console-report-primary-action ${
        report.status === "生成失败"
          ? "console-report-primary-action--regenerate"
          : "console-report-primary-action--generate"
      }`}
      type="primary"
      icon={<FileDoneOutlined />}
      onClick={() => onOpen(report, getGenerateStepForReport(report))}
    >
      {report.status === "生成失败" ? "重新生成日报" : "生成日报"}
    </Button>
  );
}

function getDailyReportCopy(report: ReportItem) {
  if (report.status === "草稿待确认") {
    return "已根据今日 AI 工作记录生成日报，确认内容后即可发送。";
  }

  if (report.status === "已发送") {
    return "今日日报已发送，可回看内容和关联的工作记录。";
  }

  if (report.status === "发送失败") {
    return "日报发送失败，请检查内容后重试发送。";
  }

  if (report.status === "生成中") {
    return "正在根据今日 AI 工作记录生成日报。";
  }

  return "选择今日 AI 工作记录，生成可确认的日报。";
}

function renderWeeklyReportAction(report: ReportItem, onOpen: (report: ReportItem, step?: ReportModalStep) => void) {
  if (isWeeklyPendingAutoGenerate(report)) {
    return null;
  }

  if (report.status === "草稿待确认" || report.status === "发送失败") {
    return (
      <Button type="link" onClick={() => onOpen(report, "editor")}>
        查看草稿
      </Button>
    );
  }

  if (report.status === "已发送") {
    return (
      <Button type="link" onClick={() => onOpen(report, "editor")}>
        查看周报
      </Button>
    );
  }

  if (report.status === "生成中") {
    return <Button type="link" disabled>生成中</Button>;
  }

  return (
    <Button type="link" onClick={() => onOpen(report, getGenerateStepForReport(report))}>
      生成周报
    </Button>
  );
}

function getWeeklyReportReminder(report: ReportItem) {
  if (isWeeklyPendingAutoGenerate(report)) {
    return "周五自动汇总本周日报与任务记录。";
  }

  return "基于本周日报、任务记录和风险变化生成。";
}

function isWeeklyPendingAutoGenerate(report: ReportItem) {
  return report.kind === "personal_weekly" && report.status === "待生成" && report.updatedAt === "-";
}

function getInitialReportModalStep(report: ReportItem): ReportModalStep {
  if (report.status === "草稿待确认" || report.status === "已发送" || report.status === "发送失败") {
    return "editor";
  }

  return getGenerateStepForReport(report);
}

function getGenerateStepForReport(report: ReportItem): ReportModalStep {
  return report.kind === "personal_daily" ? "sessions" : "source";
}

function getReportModalTitle(report: ReportItem, step: ReportModalStep) {
  if (step === "editor") {
    return report.status === "已发送" ? `查看${report.name}` : `编辑${report.name}草稿`;
  }

  return `生成${report.name}`;
}

function SessionUploadCard({
  range,
  report,
  onRangeChange,
  onViewDetail
}: {
  range: TokenRange;
  report: TokenReport;
  onRangeChange: (range: TokenRange) => void;
  onViewDetail: () => void;
}) {
  return (
    <div className="console-panel">
      <PanelHeader
        icon={<BarChartOutlined />}
        title="Token 统计"
        extra={
          <Segmented
            className="console-token-range"
            size="small"
            options={TOKEN_RANGE_OPTIONS}
            value={range}
            onChange={(value) => onRangeChange(value as TokenRange)}
          />
        }
      />
      <div className="console-report-status-card">
        {renderSessionUploadSummary(range, report)}
        <div className="console-token-footer">
          <span>基于已上传 session 解析</span>
          <Button type="link" icon={<LinkOutlined />} onClick={onViewDetail}>
            查看 Token 明细
          </Button>
        </div>
      </div>
    </div>
  );
}

function getTokenRangeLabel(range: TokenRange) {
  const option = TOKEN_RANGE_OPTIONS.find((item) => item.value === range);
  return option?.label ?? "近 7 天";
}

function renderSessionUploadSummary(range: TokenRange, report: TokenReport) {
  if (report.groups && report.groups.length > 0) {
    return (
      <div className="console-token-overview">
        <div className="console-token-total">
          <span>{getTokenRangeLabel(range)}合计</span>
          <strong>{report.total}</strong>
          <em>解析 Token</em>
        </div>
        <TokenGroupBars groups={report.groups} />
        {report.mine ? <p className="console-token-subnote">我的 Token：{report.mine.total}</p> : null}
      </div>
    );
  }

  if (typeof report.uploaders === "number") {
    return (
      <div className="console-token-overview">
        <div className="console-token-total">
          <span>{getTokenRangeLabel(range)}本组</span>
          <strong>{report.total}</strong>
          <em>解析 Token</em>
        </div>
        <TokenMiniBars bars={report.bars} />
        {report.mine ? <p className="console-token-subnote">我的 Token：{report.mine.total}</p> : null}
      </div>
    );
  }

  return (
    <div className="console-token-overview">
      <div className="console-token-total">
        <span>{getTokenRangeLabel(range)}</span>
        <strong>{report.total}</strong>
        <em>解析 Token</em>
      </div>
      <TokenMiniBars bars={report.bars} />
    </div>
  );
}

function TokenMiniBars({ bars }: { bars: TokenReport["bars"] }) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const option = useMemo<EChartsOption>(() => {
    const middleIndex = Math.floor((bars.length - 1) / 2);

    return {
      animation: false,
      grid: {
        top: 6,
        right: 60,
        bottom: 4,
        left: 46,
        containLabel: false
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "none"
        },
        borderWidth: 0,
        padding: [6, 8],
        textStyle: {
          color: "#172033",
          fontSize: 12
        },
        formatter: (params: unknown) => {
          const item = Array.isArray(params) ? params[0] : params;
          const index =
            item && typeof item === "object" && "dataIndex" in item
              ? Number((item as { dataIndex: number }).dataIndex)
              : 0;
          const bar = bars[index] ?? bars[0];
          return `${bar.label}<br />${bar.text}`;
        }
      },
      xAxis: {
        type: "value",
        show: false,
        min: 0
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: bars.map((bar) => bar.label),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: "#64748b",
          fontSize: 11,
          interval: 0,
          formatter: (value: string, index: number) =>
            bars.length <= 3 || index === 0 || index === middleIndex || index === bars.length - 1 ? value : ""
        }
      },
      series: [
        {
          type: "bar",
          data: bars.map((bar) => bar.value),
          barWidth: bars.length === 1 ? 14 : bars.length <= 3 ? 12 : 6,
          barMaxWidth: 14,
          itemStyle: {
            borderRadius: [999, 999, 999, 999],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#69a6ff" },
              { offset: 1, color: "#1677ff" }
            ])
          },
          label: {
            show: true,
            position: "right",
            color: "#526173",
            fontSize: 11,
            formatter: (params: unknown) => {
              const index =
                params && typeof params === "object" && "dataIndex" in params
                  ? Number((params as { dataIndex: number }).dataIndex)
                  : 0;
              return bars[index]?.text ?? "";
            }
          },
          emphasis: {
            itemStyle: {
              color: "#0958d9"
            }
          }
        }
      ]
    };
  }, [bars]);

  useEffect(() => {
    if (!chartRef.current) return undefined;

    const chart = echarts.init(chartRef.current, undefined, { renderer: "svg" });
    chart.setOption(option);

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [option]);

  return (
    <div className="console-token-chart" aria-label="每日解析 Token 趋势">
      <span className="console-token-chart__caption">每日解析 Token</span>
      <div ref={chartRef} className="console-token-echart" />
    </div>
  );
}

function TokenGroupBars({ groups }: { groups: NonNullable<TokenReport["groups"]> }) {
  const maxValue = Math.max(...groups.map((group) => group.value), 1);

  return (
    <div className="console-token-group-bars" aria-label="Token 分组分布">
      {groups.map((group) => (
        <div key={group.name} className="console-token-group-bars__item">
          <span>{group.name}</span>
          <i>
            <b style={{ width: `${Math.max(8, Math.round((group.value / maxValue) * 100))}%` }} />
          </i>
          <em>{group.total}</em>
        </div>
      ))}
    </div>
  );
}

function getDefaultDraftMarkdown(report: ReportItem) {
  if (report.kind === "personal_weekly") {
    return `# 本周周报

## 本周完成
* 完成控制台报告入口梳理。
* 跟进我负责和关注任务的状态变化。

## 风险与阻塞
* 飞书发送目标仍需确认。

## 下周计划
* 继续完善需求看板定位和报告生成流程。`;
  }

  if (report.kind === "team_weekly") {
    return `# 组周报

## 组整体进展
* 控制台信息架构完成收敛。

## 重点需求进展
* AI 日报生成：进入原型调整阶段。

## 组员进展摘要
* 陈一：完成个人报告入口收敛。

## 风险与阻塞
* session 导入接口字段仍需冻结。

## 下周计划
* 补齐需求看板风险定位闭环。`;
  }

  if (report.kind === "department_weekly") {
    return `# 部门周报

## 部门整体进展
* 报告能力从日报扩展为个人与汇总报告。

## 各组进展
* 平台组：控制台原型继续收敛。

## 重点需求进展
* AIcoding 管理平台完成报告口径统一。

## 风险与阻塞
* 跨组依赖和发送目标仍需对齐。

## 下周重点
* 推进需求看板和报告生成闭环。`;
  }

  if (report.kind === "team_daily") {
    return `# 组日报

## 组整体进展
* 组内成员日报和风险项已汇总。

## 重点风险
* session 解析任务仍处于阻塞状态。

## 明日计划
* 继续推进日报发送和需求看板联动。`;
  }

  if (report.kind === "department_daily") {
    return `# 部门日报

## 部门整体进展
* 各组日报已完成汇总。

## 重点风险
* 部门日报发送失败，需要重试发送。

## 明日重点
* 跟进高优先级风险和跨组依赖。`;
  }

  return DEFAULT_MARKDOWN;
}

function getReportSourceSteps(report: ReportItem) {
  if (report.kind === "personal_daily") {
    return [{ title: "选择 session" }, { title: "编辑草稿" }];
  }

  return [{ title: "确认来源" }, { title: "编辑草稿" }];
}

function getReportSourceTitle(report: ReportItem) {
  if (report.scope === "team") return "生成组报告";
  if (report.scope === "department") return "生成部门报告";
  return "生成个人周报";
}

function getReportSourceMeta(report: ReportItem, coverage?: ReportCoverage) {
  if (report.scope === "team" && coverage) {
    return `成员提交情况：应提交 ${coverage.expected}，已提交 ${coverage.submitted}，未提交 ${coverage.missing}，发送失败 ${coverage.failed}`;
  }

  if (report.scope === "department" && coverage) {
    return `各组提交情况：应提交 ${coverage.expected}，已提交 ${coverage.submitted}，未提交 ${coverage.missing}，发送失败 ${coverage.failed}`;
  }

  return "系统将读取本周个人日报、任务、风险与阻塞生成草稿。";
}

function getEditorMeta(report: ReportItem) {
  if (report.kind === "personal_daily") {
    return [`已选 ${report.sessionCount} 个 session`, report.skill];
  }

  return [report.sourceSummary, report.skill];
}

function getSendButtonText(report: ReportItem) {
  return report.kind.includes("weekly") ? "发送周报" : "发送日报";
}

function renderReportModalFooter({
  step,
  report,
  selectedCount,
  modifiedTaskCount,
  onCancel,
  onNext,
  onGenerate,
  onSave,
  onSend
}: {
  step: ReportModalStep;
  report: ReportItem;
  selectedCount: number;
  modifiedTaskCount: number;
  onCancel: () => void;
  onNext: () => void;
  onGenerate: () => void;
  onSave: () => void;
  onSend: () => void;
}) {
  if (step === "sessions") {
    return (
      <Space>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" disabled={selectedCount === 0} onClick={onNext}>
          下一步
        </Button>
      </Space>
    );
  }

  if (step === "source") {
    return (
      <Space>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={onGenerate}>
          生成草稿
        </Button>
      </Space>
    );
  }

  if (report.status === "已发送") {
    return <Button onClick={onCancel}>关闭</Button>;
  }

  return (
    <Space>
      {modifiedTaskCount > 0 ? (
        <span className="console-report-footer-note">
          已修改 {modifiedTaskCount} 个任务，发送日报后同步任务进展。
        </span>
      ) : null}
      <Button onClick={onSave}>保存草稿</Button>
      <Button type="primary" icon={<SendOutlined />} onClick={onSend}>
        {getSendButtonText(report)}
      </Button>
    </Space>
  );
}

function TaskProgressSuggestionList({
  tasks,
  onEditTask
}: {
  tasks: TaskProgressSuggestion[];
  onEditTask: (task: TaskProgressSuggestion) => void;
}) {
  return (
    <aside className="console-task-suggestion-list">
      <div className="console-session-modal__section">
        <strong>任务进展建议</strong>
        <span>LLM 根据已选 session 生成，可按需修改。</span>
      </div>
      {tasks.map((task) => (
        <article key={task.key} className="console-task-suggestion-card">
          <strong>任务：{task.taskName}</strong>
          <span>建议进度：{task.progress}%，{task.status}</span>
          <span>关联 session：{task.sessionIds.length} 个</span>
          <ul>
            {task.sessionIds.map((sessionId) => {
              const session = getSessionById(sessionId);
              return <li key={sessionId}>{session ? `${session.tool} ${session.timeRange}` : sessionId}</li>;
            })}
          </ul>
          <Space size={8}>
            {task.syncState ? <Tag color="blue">{task.syncState}</Tag> : null}
            <Button type="link" onClick={() => onEditTask(task)}>修改</Button>
          </Space>
        </article>
      ))}
    </aside>
  );
}

function getSessionById(sessionId: string) {
  return SESSION_OPTIONS.find((session) => session.value === sessionId);
}

function TaskProgressEditModal({
  task,
  open,
  onCancel,
  onChange,
  onSave
}: {
  task: TaskProgressSuggestion | null;
  open: boolean;
  onCancel: () => void;
  onChange: (task: TaskProgressSuggestion | null) => void;
  onSave: () => void;
}) {
  if (!task) return null;

  return (
    <Modal
      title="修改任务进展"
      open={open}
      width={560}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={onSave}>保存</Button>
        </Space>
      }
    >
      <div className="console-task-edit-form">
        <div className="console-session-modal__section">
          <strong>任务：{task.taskName}</strong>
        </div>
        <label>
          <span>进度：</span>
          <Select
            value={task.progress}
            options={[25, 50, 75, 100].map((value) => ({ label: `${value}%`, value }))}
            onChange={(progress) => onChange({ ...task, progress })}
          />
        </label>
        <label>
          <span>状态：</span>
          <Select
            value={task.status}
            options={["未开始", "进行中", "已完成"].map((value) => ({ label: value, value }))}
            onChange={(status) => onChange({ ...task, status })}
          />
        </label>
        <div className="console-session-modal__section">
          <strong>关联 session：</strong>
          <Checkbox.Group
            value={task.sessionIds}
            onChange={(value) => onChange({ ...task, sessionIds: value as string[] })}
          >
            <div className="console-task-edit-sessions">
              {SESSION_OPTIONS.map((session) => (
                <Checkbox key={session.value} value={session.value}>
                  {session.tool} {session.timeRange}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        </div>
        <label>
          <span>备注：</span>
          <Input.TextArea
            value={task.note}
            rows={3}
            placeholder="可选填写"
            onChange={(event) => onChange({ ...task, note: event.target.value })}
          />
        </label>
      </div>
    </Modal>
  );
}

function ReportModalContent({
  step,
  report,
  coverage,
  selectedSessionIds,
  taskSuggestions,
  draftMarkdown,
  onSelectedSessionIdsChange,
  onEditTask,
  onDraftMarkdownChange
}: {
  step: ReportModalStep;
  report: ReportItem;
  coverage: ReportCoverage;
  selectedSessionIds: string[];
  taskSuggestions: TaskProgressSuggestion[];
  draftMarkdown: string;
  onSelectedSessionIdsChange: (value: string[]) => void;
  onEditTask: (task: TaskProgressSuggestion) => void;
  onDraftMarkdownChange: (value: string) => void;
}) {
  if (step === "sessions") {
    return (
      <div className="console-report-modal">
        <Steps
          size="small"
          current={0}
          items={getReportSourceSteps(report)}
        />
        <div className="console-session-modal__section">
          <strong>6 月 22 日可用 session</strong>
          <span>默认勾选系统认为应进入日报的 session，可手动调整。</span>
        </div>
        <Checkbox.Group value={selectedSessionIds} onChange={(value) => onSelectedSessionIdsChange(value as string[])}>
          <div className="console-session-list">
            {SESSION_OPTIONS.map((session) => (
              <label key={session.value} className="console-session-item">
                <Checkbox value={session.value} />
                <span>
                  <strong>{session.tool}</strong>
                  <em>{session.timeRange} · {session.summary}</em>
                </span>
                {session.recommended ? <Tag color="blue">默认勾选</Tag> : null}
              </label>
            ))}
          </div>
        </Checkbox.Group>
      </div>
    );
  }

  if (step === "source") {
    return (
      <div className="console-report-modal">
        <Steps
          size="small"
          current={0}
          items={getReportSourceSteps(report)}
        />
        <div className="console-session-modal__section">
          <strong>{getReportSourceTitle(report)}</strong>
          <span>{report.sourceSummary}</span>
        </div>
        <div className="console-editor-shell__meta">
          <Tag color="blue">{report.generateMode}</Tag>
          <span>{getReportSourceMeta(report, coverage)}</span>
        </div>
      </div>
    );
  }

  const isReadOnly = report.status === "已发送";

  return (
    <div className="console-report-modal">
      <Steps
        size="small"
        current={1}
        items={getReportSourceSteps(report)}
      />
      <div className="console-editor-shell__meta">
        <Tag color={report.generateMode === "系统自动生成" ? "blue" : "gold"}>{report.generateMode}</Tag>
        {getEditorMeta(report).map((meta) => (
          <span key={meta}>{meta}</span>
        ))}
      </div>
      <div className={report.kind === "personal_daily" ? "console-daily-editor-layout" : undefined}>
        <Input.TextArea
          className="console-markdown-textarea"
          value={draftMarkdown}
          rows={18}
          readOnly={isReadOnly}
          onChange={(event) => onDraftMarkdownChange(event.target.value)}
        />
        {report.kind === "personal_daily" ? (
          <TaskProgressSuggestionList tasks={taskSuggestions} onEditTask={onEditTask} />
        ) : null}
      </div>
    </div>
  );
}

function ReportStatusTag({ status }: { status: ReportStatus }) {
  const color =
    status === "已发送"
      ? "green"
      : status === "发送失败" || status === "生成失败"
        ? "red"
        : status === "草稿待确认" || status === "生成中"
          ? "blue"
          : "gold";
  const label = status === "草稿待确认" ? "待确认" : status;
  return <Tag color={color}>{label}</Tag>;
}

function FollowCard({ item, onView }: { item: FollowItem; onView: (item: FollowItem) => void }) {
  const isTask = item.type === "任务";

  return (
    <article className="console-follow-card">
      <Space size={8} wrap>
        <Tag color={isTask ? "geekblue" : "green"}>{item.type}</Tag>
        <Badge status={item.status === "阻塞" ? "error" : "processing"} text={item.status} />
      </Space>
      <div className="console-follow-card__title">
        <strong>{item.title}</strong>
        <span>{isTask && item.requirement ? `所属需求：${item.requirement}` : item.dependency}</span>
      </div>
      <span>{item.owner}</span>
      <span>{item.deadline}</span>
      <div className="console-follow-card__reminder">
        <Tag color={item.risk.includes("阻塞") || item.status === "阻塞" ? "red" : "orange"}>
          {item.risk}
        </Tag>
        {item.activity ? <em>{item.activity}</em> : null}
      </div>
      <Button
        type="link"
        icon={<RightOutlined />}
        aria-label={`查看${item.title}详情`}
        onClick={() => onView(item)}
      >
        详情
      </Button>
    </article>
  );
}

function sortFollowItems(items: FollowItem[]) {
  return [...items].sort((a, b) => getFollowPriority(a) - getFollowPriority(b));
}

function getFollowPriority(item: FollowItem) {
  if (item.risk.includes("超期") || item.risk.includes("已超期")) return 1;
  if (item.risk.includes("临期") || item.deadline === "明天") return 2;
  if (item.risk.includes("依赖") || item.status === "阻塞") return 3;
  if (item.status === "进行中") return 4;
  if (item.status === "已完成") return 9;
  return 5;
}

function RiskCard({ item, onAction }: { item: RiskItem; onAction: (item: RiskItem) => void }) {
  return (
    <article className={`console-risk-card console-risk-card--${item.tone}`}>
      <span className={`console-risk-tag console-risk-tag--${item.tone}`}>{item.level} · {item.source}</span>
      <div className="console-risk-card__title">
        <strong>{item.title}</strong>
        <p>{item.reason}</p>
      </div>
      <span>{item.target}</span>
      <span>{item.owner}</span>
      <span>
        <ClockCircleOutlined /> {item.deadline}
      </span>
      <Button type="link" icon={<LinkOutlined />} onClick={() => onAction(item)}>
        {getRiskActionLabel(item)}
      </Button>
    </article>
  );
}

function getRiskActionLabel(item: RiskItem) {
  if (item.riskType === "dependency_blocker") return "处理依赖";
  if (item.riskType === "deadline") return "查看任务";
  return item.actionText;
}

function sortRisks(risks: RiskItem[]) {
  return [...risks].sort((a, b) => getRiskPriority(a) - getRiskPriority(b));
}

function getRiskPriority(risk: RiskItem) {
  if (risk.riskType === "deadline" && risk.source === "已超期") return 1;
  if (risk.riskType === "dependency_blocker") return 2;
  return 3;
}

