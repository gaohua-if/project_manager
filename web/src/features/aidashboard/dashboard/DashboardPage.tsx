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
  UploadOutlined,
} from "@ant-design/icons";
import { Alert, App, Badge, Button, Checkbox, Col, Empty, Input, Modal, Popconfirm, Row, Segmented, Select, Space, Steps, Tag, Upload } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { useAuth } from "@/shared/auth/authContext";
import type { UserRole } from "@/shared/auth/types";
import { formatDateTime } from "@/shared/utils/dateTime";

import {
  fetchDepartmentReportSources,
  fetchDepartmentReportTodayOrNull,
	fetchDashboardFollows,
	fetchDashboardRisks,
  fetchReports,
	fetchSessions,
  fetchSessionTokens,
  fetchTeamReportSources,
  fetchTeamReportTodayOrNull,
	fetchTodayReport,
  fetchTokens,
  generateDepartmentReport,
  generateTeamReport,
	generateTodayReportDraft,
  updateDepartmentReport,
	updateReport as updateDailyReport,
  submitTeamReport,
  updateTeamReport,
	updateTaskProgress,
	updateTaskStatus
} from "../api/client";
import type {
  DailyReport,
  DepartmentReport,
  DepartmentReportSources,
  GenerateReportDraftPayload,
  Session,
  TaskProgressSuggestion as DraftTaskProgressSuggestion,
  TeamReport,
  TeamReportSources
} from "../api/types";
import {
  aggregateDashboardTokenReport,
  getDashboardTokenDateRange,
  type DashboardTokenRange,
  type DashboardTokenReport
} from "./dashboardTokenStats";

import "./console-dashboard.css";

type DashboardRole = "employee" | "team_leader" | "director" | "pm";
type ReportStatus = "待生成" | "生成中" | "草稿待确认" | "已归档" | "生成失败";
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
type TokenRange = DashboardTokenRange;
type ReportSkillOption = { label: string; value: string; source?: "system" | "upload"; content?: string };
type DraftTaskStatus = "todo" | "in_progress" | "done";

interface SessionOption {
  tool: string;
  timeRange: string;
  summary: string;
  value: string;
  recommended: boolean;
}

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

type TokenReport = DashboardTokenReport;

interface TaskProgressSuggestion {
  key: string;
  taskId: string;
  taskName: string;
  progress: number;
  status: DraftTaskStatus;
  sessionIds: string[];
  evidenceSessionTitles: string[];
  note: string;
  syncState?: "已修改" | "待同步";
}

const REPORT_SKILL_OPTIONS: ReportSkillOption[] = [
  { label: "默认日报 Skill", value: "default_daily", source: "system" }
];

const TOKEN_RANGE_OPTIONS: { label: string; value: TokenRange }[] = [
  { label: "昨天", value: "yesterday" },
  { label: "近 3 天", value: "last3days" },
  { label: "近 7 天", value: "last7days" }
];

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

function findCurrentUserDailyReport(reports: DailyReport[], userId: string | undefined, reportDate: string) {
  if (!userId) return undefined;
  return reports.find((report) => report.user_id === userId && report.report_date === reportDate);
}

function applyTodayDailyReportState(report: ReportItem, dailyReport: DailyReport | undefined, loaded: boolean): ReportItem {
  if (!loaded) return report;
  if (!dailyReport) {
    return {
      ...report,
      status: "待生成",
      sessionCount: 0,
      updatedAt: "-"
    };
  }

  return {
    ...report,
    status: "草稿待确认",
    sessionCount: dailyReport.session_ids.length,
    generateMode: dailyReport.edited ? "手动生成" : "系统自动生成",
    updatedAt: formatDateTime(dailyReport.updated_at, "HH:mm")
  };
}

function applyTeamDailyReportState(report: ReportItem, teamReport: TeamReport | null | undefined, loaded: boolean): ReportItem {
  if (!loaded) return report;
  if (!teamReport) {
    return {
      ...report,
      status: "待生成",
      sessionCount: 0,
      updatedAt: "-"
    };
  }

  return {
    ...report,
    status: teamReport.submitted_at ? "已归档" : "草稿待确认",
    sessionCount: teamReport.source_daily_report_ids.length || teamReport.member_report_ids.length,
    generateMode: "系统自动生成",
    skill: "小组日报 Agent",
    updatedAt: formatDateTime(teamReport.updated_at, "HH:mm")
  };
}

const ROLE_DATA: Record<DashboardRole, ConsoleRoleData> = {
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
        description: "本周周报尚未生成，可查看来源后生成草稿。",
        sourceSummary: "本周个人日报、个人工作记录、风险与阻塞",
        updatedAt: "-"
      })
    ],
    coverage: { expected: 1, submitted: 0, missing: 1, failed: 0 },
    metrics: {
      focusCount: "4",
      focusNote: "我负责或主动关注的任务",
      riskCount: "3",
      riskNote: "1 个阻塞，2 个超期",
      dueCount: "2",
      dueNote: "已超过截止日期"
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
        deadline: "2026-06-23",
        dependency: "无阻塞依赖",
        risk: "已超期",
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
        title: "日报生成验收标准已超过截止日期",
        source: "已超期",
        target: "AI 日报生成 / 补充验收标准",
        relatedObjectType: "task",
        requirementId: "req-ai-daily",
        taskId: "task-daily-ac",
        owner: "我",
        deadline: "2026-06-23",
        reason: "任务尚未完成，需要更新计划或推进状态",
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
        sourceSummary: "本周个人日报、个人工作记录、风险与阻塞",
        updatedAt: "17:40"
      })
    ],
    summaryReports: [
      createReport({
        id: "tl-team-daily",
        kind: "team_daily",
        scope: "team",
        name: "今日组日报",
        status: "待生成",
        description: "先查看成员原始日报收集情况，再生成小组日报草稿。",
        sourceSummary: "成员当天原始日报",
        updatedAt: "-"
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
        risk: "已超期",
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
        status: "已归档",
        description: "今日日报已归档。",
        sourceSummary: "个人当日 session + 用户当天相关任务/需求状态",
        sessionCount: 1,
        updatedAt: "17:55"
      }),
      createReport({
        id: "director-personal-weekly",
        kind: "personal_weekly",
        scope: "personal",
        name: "本周个人周报",
        status: "草稿待确认",
        description: "系统已根据本周日报和任务记录生成周报草稿，请确认后发送。",
        sourceSummary: "本周个人日报、个人工作记录、风险与阻塞",
        updatedAt: "17:20"
      })
    ],
    summaryReports: [
      createReport({
        id: "director-department-daily",
        kind: "department_daily",
        scope: "department",
        name: "今日部门日报",
        status: "待生成",
        description: "先查看各组小组日报收集情况，再生成部门日报草稿。",
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
        description: "本周周报尚未生成，可查看来源后生成草稿。",
        sourceSummary: "本周个人日报、个人工作记录、风险与阻塞",
        updatedAt: "-"
      })
    ],
    coverage: { expected: 1, submitted: 0, missing: 1, failed: 0 },
    metrics: {
      focusCount: "7",
      focusNote: "我关注的需求",
      riskCount: "5",
      riskNote: "2 个超期，1 个依赖",
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
        risk: "关键任务已超期",
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
        risk: "已超期",
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
        title: "AI 日报生成存在关键任务超期",
        source: "已超期",
        target: "AI 日报生成 / 补齐验收标准模板",
        relatedObjectType: "requirement",
        requirementId: "req-ai-daily",
        taskId: "task-ac-template",
        owner: "韩梅梅",
        deadline: "2026-06-26",
        reason: "关键任务「补齐验收标准模板」已超过截止日期",
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { message } = App.useApp();
  const today = dayjs();
  const reportDate = today.format("YYYY-MM-DD");
	const followsQuery = useQuery({
		queryKey: ["dashboard", "follows"],
		queryFn: fetchDashboardFollows,
		staleTime: 30_000
	});
	const risksQuery = useQuery({
		queryKey: ["dashboard", "risks"],
		queryFn: fetchDashboardRisks,
		staleTime: 30_000
	});
  const todayReportsQuery = useQuery({
    queryKey: ["reports", "dashboard-today", reportDate],
    queryFn: () => fetchReports({ from: reportDate, to: reportDate }),
    staleTime: 30_000
  });
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
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [validatedDraftSessionIds, setValidatedDraftSessionIds] = useState<string[]>([]);
  const [sessionSelectionTouched, setSessionSelectionTouched] = useState(false);
  const [reportSkillDraft, setReportSkillDraft] = useState<string>(REPORT_SKILL_OPTIONS[0].value);
  const [uploadedReportSkills, setUploadedReportSkills] = useState<ReportSkillOption[]>([]);
  const [draftMarkdown, setDraftMarkdown] = useState(DEFAULT_MARKDOWN);
  const [draftMarkdownTouched, setDraftMarkdownTouched] = useState(false);
  const [teamDraft, setTeamDraft] = useState<TeamReport | null>(null);
  const [departmentDraft, setDepartmentDraft] = useState<DepartmentReport | null>(null);
  const [taskSuggestions, setTaskSuggestions] = useState<TaskProgressSuggestion[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
  const [editingTaskDraft, setEditingTaskDraft] = useState<TaskProgressSuggestion | null>(null);
  const [tokenRange, setTokenRange] = useState<TokenRange>("last3days");
  const dashboardRole = getDashboardRole(user?.role);
  const data = useMemo(() => ROLE_DATA[dashboardRole], [dashboardRole]);
  const departmentSourcesQuery = useQuery({
    queryKey: ["department-report-sources", reportDate],
    queryFn: () => fetchDepartmentReportSources(reportDate),
    enabled: dashboardRole === "director",
    staleTime: 30_000
  });
  const teamSourcesQuery = useQuery({
    queryKey: ["team-report-sources", reportDate],
    queryFn: () => fetchTeamReportSources(reportDate),
    enabled: dashboardRole === "team_leader",
    staleTime: 30_000
  });
  const teamReportQuery = useQuery({
    queryKey: ["team-report-today", reportDate],
    queryFn: () => fetchTeamReportTodayOrNull(),
    enabled: dashboardRole === "team_leader",
    staleTime: 30_000
  });
  const departmentReportQuery = useQuery({
    queryKey: ["department-report-today", reportDate],
    queryFn: () => fetchDepartmentReportTodayOrNull(),
    enabled: dashboardRole === "director" && isReportModalOpen && activeReportId === "director-department-daily",
    staleTime: 30_000
  });
  const todayDailyReport = useMemo(
    () => findCurrentUserDailyReport(todayReportsQuery.data ?? [], user?.id, reportDate),
    [reportDate, todayReportsQuery.data, user?.id]
  );
  const personalReports = data.personalReports.map((reportItem) => {
    const currentReport = reportStateById[reportItem.id] ?? reportItem;
    if (reportItem.kind !== "personal_daily") return currentReport;
    return applyTodayDailyReportState(currentReport, todayDailyReport, todayReportsQuery.isSuccess);
  });
  const summaryReports = (data.summaryReports ?? []).map((reportItem) => {
    const currentReport = reportStateById[reportItem.id] ?? reportItem;
    if (reportItem.kind !== "team_daily") return currentReport;
    return applyTeamDailyReportState(currentReport, teamReportQuery.data, teamReportQuery.isSuccess);
  });
  const effectiveCoverage =
    dashboardRole === "director" && departmentSourcesQuery.data
      ? {
          expected: departmentSourcesQuery.data.total_team_count,
          submitted: departmentSourcesQuery.data.submitted_team_count,
          missing: departmentSourcesQuery.data.missing_teams.length,
          failed: 0
        }
      : dashboardRole === "team_leader" && teamSourcesQuery.data
        ? {
            expected: teamSourcesQuery.data.members.length,
            submitted: teamSourcesQuery.data.submitted,
            missing: teamSourcesQuery.data.missing,
            failed: 0
          }
      : data.coverage;
  const dailyReport = personalReports.find((reportItem) => reportItem.kind === "personal_daily") ?? personalReports[0];
  const availableReportIds = new Set([...personalReports, ...summaryReports].map((reportItem) => reportItem.id));
  const allVisibleReports = [...personalReports, ...summaryReports];
  const activeReport = availableReportIds.has(activeReportId)
    ? allVisibleReports.find((reportItem) => reportItem.id === activeReportId) ?? dailyReport
    : dailyReport;
  const tokenDateRange = useMemo(() => getDashboardTokenDateRange(tokenRange), [tokenRange]);
  const tokenScope = dashboardRole === "employee" ? "mine" : "team";
  const shouldLoadMineTokens = dashboardRole !== "employee";
  const shouldLoadTeamTokenGroups = dashboardRole === "director";
  const tokenSessionsQuery = useQuery({
    queryKey: ["dashboard", "token-sessions", tokenDateRange.from, tokenDateRange.to, tokenScope],
    queryFn: () => fetchSessionTokens({ from: tokenDateRange.from, to: tokenDateRange.to, scope: tokenScope }),
    staleTime: 60_000
  });
  const mineTokenSessionsQuery = useQuery({
    queryKey: ["dashboard", "token-sessions", tokenDateRange.from, tokenDateRange.to, "mine"],
    queryFn: () => fetchSessionTokens({ from: tokenDateRange.from, to: tokenDateRange.to, scope: "mine" }),
    enabled: shouldLoadMineTokens,
    staleTime: 60_000
  });
  const teamTokenGroupsQuery = useQuery({
    queryKey: ["dashboard", "token-groups", tokenDateRange.from, tokenDateRange.to, "team"],
    queryFn: () =>
      fetchTokens({
        period: "range",
        from: tokenDateRange.from,
        to: tokenDateRange.to,
        group_by: "team"
      }),
    enabled: shouldLoadTeamTokenGroups,
    staleTime: 60_000
  });
  const reportSkillOptions = useMemo(
    () => [...REPORT_SKILL_OPTIONS, ...uploadedReportSkills],
    [uploadedReportSkills]
  );
  const tokenReport = useMemo(
    () =>
      aggregateDashboardTokenReport(tokenSessionsQuery.data ?? [], tokenDateRange, {
        mineSessions: shouldLoadMineTokens ? mineTokenSessionsQuery.data ?? [] : undefined,
        teamAggregation: shouldLoadTeamTokenGroups ? teamTokenGroupsQuery.data ?? null : null,
        showUploaders: dashboardRole !== "employee"
      }),
    [
      dashboardRole,
      mineTokenSessionsQuery.data,
      shouldLoadMineTokens,
      shouldLoadTeamTokenGroups,
      teamTokenGroupsQuery.data,
      tokenDateRange,
      tokenSessionsQuery.data
    ]
  );
  const isTokenLoading =
    tokenSessionsQuery.isLoading ||
    (shouldLoadMineTokens && mineTokenSessionsQuery.isLoading) ||
    (shouldLoadTeamTokenGroups && teamTokenGroupsQuery.isLoading);
  const isTokenError =
    tokenSessionsQuery.isError ||
    (shouldLoadMineTokens && mineTokenSessionsQuery.isError) ||
    (shouldLoadTeamTokenGroups && teamTokenGroupsQuery.isError);
		const followItems: FollowItem[] = followsQuery.data ?? [];
		const riskItems: RiskItem[] = risksQuery.data ?? [];
  const modifiedTaskCount = taskSuggestions.filter((task) => task.syncState === "待同步").length;
  const followBlockedCount = followItems.filter((item) => item.risk.includes("阻塞") || item.status === "阻塞").length;
  const followUrgentCount = followItems.filter((item) => item.risk.includes("超期")).length;
  const reportSessionsQuery = useQuery({
    queryKey: ["dashboard", "daily-report-sessions", reportDate],
    queryFn: () =>
      fetchSessions({
        started_from: today.startOf("day").toISOString(),
        started_to: today.endOf("day").toISOString(),
        page: "1",
        page_size: "100"
      }),
    enabled: isReportModalOpen && activeReport.kind === "personal_daily",
    staleTime: 30_000
  });
  const currentUserId = user?.id;
  const reportSessionItems = reportSessionsQuery.data?.items;
  const reportSessions = useMemo(() => {
    const items = reportSessionItems ?? [];
    if (!currentUserId) return items;
    return items.filter((session) => session.user_id === currentUserId);
  }, [currentUserId, reportSessionItems]);
  const sessionOptions = useMemo(
    () => reportSessions.map((session) => toSessionOption(session)),
    [reportSessions]
  );
  const selectedSkill = reportSkillOptions.find((skill) => skill.value === reportSkillDraft);
  const effectiveSelectedSessionIds = sessionSelectionTouched
    ? selectedSessionIds
    : sessionOptions.map((session) => session.value);
  const handleSelectedSessionIdsChange = (value: string[]) => {
    setSessionSelectionTouched(true);
    setSelectedSessionIds(value);
  };
  const effectiveDraftMarkdown =
    activeReport.kind === "team_daily" &&
    reportModalStep === "editor" &&
    !draftMarkdownTouched &&
    draftMarkdown === "" &&
    teamReportQuery.data?.content
      ? teamReportQuery.data.content
      : draftMarkdown;
  const handleDraftMarkdownChange = (value: string) => {
    setDraftMarkdownTouched(true);
    setDraftMarkdown(value);
  };

  const updateReport = (reportId: string, next: Partial<ReportItem>) => {
    setReportStateById((current) => ({
      ...current,
      [reportId]: {
        ...current[reportId],
        ...next
      }
    }));
  };

	  const draftMutation = useMutation({
	    mutationFn: (payload: GenerateReportDraftPayload) => generateTodayReportDraft(payload),
	    onSuccess: (draft) => {
	      setDraftMarkdown(draft.report_markdown);
      setDraftMarkdownTouched(false);
      setSelectedSessionIds(draft.selected_session_ids);
      setValidatedDraftSessionIds(draft.selected_session_ids);
      setTaskSuggestions(draft.task_progress_suggestions.map(mapDraftTaskSuggestion));
      updateReport(activeReport.id, {
        status: "草稿待确认",
        sessionCount: draft.selected_session_ids.length,
        generateMode: "手动生成",
        skill: draft.skill_name,
	        updatedAt: "刚刚",
	        nextAt: "19:00"
	      });
	      setReportModalStep("editor");
	      void queryClient.invalidateQueries({ queryKey: ["reports"] });
	    },
    onError: (error: unknown) => {
      const text = error instanceof Error ? error.message : "日报草稿生成失败";
      setDraftError(text);
      message.error(text);
	    }
	  });

  const departmentGenerateMutation = useMutation({
    mutationFn: () => generateDepartmentReport(),
    onSuccess: (report) => {
      setDepartmentDraft(report);
      setDraftMarkdown(report.content);
      updateReport(activeReport.id, {
        status: "草稿待确认",
        sessionCount: report.source_team_report_ids.length,
        generateMode: "系统自动生成",
        skill: "部门日报 Agent",
        updatedAt: "刚刚"
      });
      setReportModalStep("editor");
      void queryClient.invalidateQueries({ queryKey: ["department-report-today"] });
    },
    onError: (error: unknown) => {
      const text = error instanceof Error ? error.message : "部门日报草稿生成失败";
      setDraftError(text);
      message.error(text);
    }
  });

  const teamGenerateMutation = useMutation({
    mutationFn: () => generateTeamReport(),
    onSuccess: (report) => {
      setTeamDraft(report);
      setDraftMarkdown(report.content);
      setDraftMarkdownTouched(false);
      updateReport(activeReport.id, {
        status: "草稿待确认",
        sessionCount: report.source_daily_report_ids.length || report.member_report_ids.length,
        generateMode: "系统自动生成",
        skill: "小组日报 Agent",
        updatedAt: "刚刚"
      });
      queryClient.setQueryData(["team-report-today", reportDate], report);
      queryClient.setQueryData(["team-report-today"], report);
      setReportModalStep("editor");
      void queryClient.invalidateQueries({ queryKey: ["team-report-today"] });
      void queryClient.invalidateQueries({ queryKey: ["team-report-sources"] });
    },
    onError: (error: unknown) => {
      const text = error instanceof Error ? error.message : "小组日报草稿生成失败";
      setDraftError(text);
      message.error(text);
    }
  });

  const saveTeamMutation = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      const current = teamDraft ?? teamReportQuery.data;
      if (!current) {
        throw new Error("请先生成小组日报草稿");
      }
      const saved = await updateTeamReport(current.id, { content: effectiveDraftMarkdown });
      return submit ? submitTeamReport(saved.id) : saved;
    },
    onSuccess: (report, variables) => {
      setTeamDraft(report);
      setDraftMarkdown(report.content);
      updateReport(activeReport.id, {
        status: report.submitted_at ? "已归档" : "草稿待确认",
        sessionCount: report.source_daily_report_ids.length || report.member_report_ids.length,
        generateMode: "系统自动生成",
        skill: "小组日报 Agent",
        updatedAt: "刚刚"
      });
      queryClient.setQueryData(["team-report-today", reportDate], report);
      queryClient.setQueryData(["team-report-today"], report);
      void queryClient.invalidateQueries({ queryKey: ["team-report-today"] });
      void queryClient.invalidateQueries({ queryKey: ["team-report-sources"] });
      void queryClient.invalidateQueries({ queryKey: ["department-report-sources"] });
      message.success(variables.submit ? "已提交给总监" : "小组日报已保存");
      if (variables.submit) {
        setIsReportModalOpen(false);
      }
    },
    onError: (error: unknown) => {
      message.error(error instanceof Error ? error.message : "小组日报保存失败");
    }
  });

  const saveDepartmentMutation = useMutation({
    mutationFn: async ({ archive }: { archive: boolean }) => {
      const current = departmentDraft ?? departmentReportQuery.data;
      if (!current) {
        throw new Error("请先生成部门日报草稿");
      }
      return updateDepartmentReport(current.id, { content: draftMarkdown, archive });
    },
    onSuccess: (report, variables) => {
      setDepartmentDraft(report);
      setDraftMarkdown(report.content);
      setDraftMarkdownTouched(false);
      updateReport(activeReport.id, {
        status: variables.archive ? "已归档" : "草稿待确认",
        sessionCount: report.source_team_report_ids.length,
        generateMode: "系统自动生成",
        skill: "部门日报 Agent",
        updatedAt: "刚刚"
      });
      void queryClient.invalidateQueries({ queryKey: ["department-report-today"] });
      message.success(variables.archive ? "部门日报已归档" : "部门日报已保存");
      if (variables.archive) {
        setIsReportModalOpen(false);
      }
    },
    onError: (error: unknown) => {
      message.error(error instanceof Error ? error.message : "部门日报保存失败");
    }
  });

	  const saveReportMutation = useMutation({
    mutationFn: async ({ closeAfterSave }: { closeAfterSave: boolean }) => {
      const report = await fetchTodayReport();
      const sessionIDs = validatedDraftSessionIds.length > 0 ? validatedDraftSessionIds : effectiveSelectedSessionIds;
      const saved = await updateDailyReport(report.id, {
        content: draftMarkdown,
        session_ids: sessionIDs
      });
      return { saved, closeAfterSave };
    },
	    onSuccess: ({ saved, closeAfterSave }) => {
	      message.success(closeAfterSave ? "日报已保存" : "日报修改已保存");
	      updateReport(activeReport.id, {
	        status: "草稿待确认",
	        sessionCount: saved.session_ids.length,
	        generateMode: "手动生成",
	        skill: saved.edited ? "默认日报 Skill" : activeReport.skill,
        updatedAt: "刚刚"
      });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      if (closeAfterSave) {
        setIsReportModalOpen(false);
      }
    },
    onError: (error: unknown) => {
      message.error(error instanceof Error ? error.message : "日报保存失败");
    }
  });

  const applyTaskSuggestionMutation = useMutation({
    mutationFn: async (task: TaskProgressSuggestion) => {
      if (task.status === "done") {
        return updateTaskStatus(task.taskId, "done");
      }
      await updateTaskStatus(task.taskId, task.status);
      return updateTaskProgress(task.taskId, task.progress);
    },
    onSuccess: (_, task) => {
      message.success("任务进展已更新");
      setTaskSuggestions((current) =>
        current.map((item) =>
          item.key === task.key
            ? {
                ...task,
                syncState: "已修改"
              }
            : item
        )
      );
      setEditingTaskKey(null);
      setEditingTaskDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: unknown) => {
      message.error(error instanceof Error ? error.message : "任务更新失败");
    }
  });

  const openReportModal = (reportItem: ReportItem, step?: ReportModalStep) => {
    const nextStep = step ?? getInitialReportModalStep(reportItem);
    setDraftMarkdownTouched(false);
    if (reportItem.kind === "personal_daily" && nextStep === "sessions") {
      setSelectedSessionIds([]);
      setValidatedDraftSessionIds([]);
      setSessionSelectionTouched(false);
      setTaskSuggestions([]);
      setDraftMarkdown("");
    }
    if (reportItem.kind === "department_daily" && nextStep === "source") {
      setDraftError(null);
      setDepartmentDraft(null);
      setDraftMarkdown("");
    }
    if (reportItem.kind === "team_daily") {
      setDraftError(null);
      setTeamDraft(null);
      setDraftMarkdownTouched(false);
      setDraftMarkdown(nextStep === "editor" ? (teamReportQuery.data?.content ?? "") : "");
    }
    setActiveReportId(reportItem.id);
    setReportSkillDraft(
      reportSkillOptions.some((skill) => skill.value === reportItem.skill)
        ? reportItem.skill
        : REPORT_SKILL_OPTIONS[0].value
    );
    if (nextStep !== "sessions" && reportItem.kind !== "department_daily" && reportItem.kind !== "team_daily") {
      setDraftMarkdown(getDefaultDraftMarkdown(reportItem));
    }
    setDraftError(null);
    setReportModalStep(nextStep);
    setIsReportModalOpen(true);
  };

  const uploadReportSkill = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".md")) {
      message.error("请上传 markdown 格式的 skill.md 文件");
      return false;
    }

    void file.text().then((content) => {
      const uploadedSkillName = getUploadedSkillName(file.name, content);
      const uploadedSkillValue = `upload:${uploadedSkillName}`;
      setUploadedReportSkills((current) => {
        const next = current.filter((item) => item.value !== uploadedSkillValue);
        return [...next, { label: uploadedSkillName, value: uploadedSkillValue, source: "upload", content }];
      });
      setReportSkillDraft(uploadedSkillValue);
      message.success("Skill 已载入，本次生成将作为补充约束");
    }).catch(() => {
      message.error("Skill 文件读取失败");
    });

    return false;
  };

  const startGenerateDraft = () => {
    if (!activeReport) return;

    if (activeReport.kind === "personal_daily") {
      setDraftError(null);
      const payload: GenerateReportDraftPayload = {
        report_date: reportDate,
        session_ids: effectiveSelectedSessionIds,
        skill_id: "default_daily",
        skill_content: selectedSkill?.source === "upload" ? selectedSkill.content : undefined,
        include_task_progress: true
      };
      draftMutation.mutate(payload);
      return;
    }

    if (activeReport.kind === "department_daily") {
      setDraftError(null);
      departmentGenerateMutation.mutate();
      return;
    }

    if (activeReport.kind === "team_daily") {
      setDraftError(null);
      teamGenerateMutation.mutate();
      return;
    }

    updateReport(activeReport.id, {
      status: "草稿待确认",
      sessionCount: activeReport.sessionCount,
      generateMode: "系统自动生成",
      skill: reportSkillDraft,
      updatedAt: "刚刚"
    });
    setReportModalStep("editor");
  };

  const saveDraft = () => {
    if (!activeReport) return;
    if (activeReport.kind === "personal_daily") {
      saveReportMutation.mutate({ closeAfterSave: false });
      return;
    }
    if (activeReport.kind === "department_daily") {
      saveDepartmentMutation.mutate({ archive: false });
      return;
    }
    if (activeReport.kind === "team_daily") {
      saveTeamMutation.mutate({ submit: false });
      return;
    }
    updateReport(activeReport.id, { status: "草稿待确认", updatedAt: "刚刚" });
  };

  const goBackReportModalStep = () => {
    if (!activeReport) return;
    setReportModalStep(getGenerateStepForReport(activeReport));
  };

  const sendReport = () => {
    if (!activeReport) return;
    if (activeReport.kind === "personal_daily") {
      saveReportMutation.mutate({ closeAfterSave: true });
      return;
    }
    if (activeReport.kind === "department_daily") {
      saveDepartmentMutation.mutate({ archive: true });
      return;
    }
    if (activeReport.kind === "team_daily") {
      saveTeamMutation.mutate({ submit: true });
      return;
    }
    updateReport(activeReport.id, { status: "已归档", updatedAt: "刚刚" });
    setIsReportModalOpen(false);
  };

  const openTaskEditModal = (task: TaskProgressSuggestion) => {
    setEditingTaskKey(task.key);
    setEditingTaskDraft({ ...task });
  };

  const saveTaskEdit = () => {
    if (!editingTaskKey || !editingTaskDraft) return;
    applyTaskSuggestionMutation.mutate(editingTaskDraft);
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
        <div className="console-panel console-panel--follow">
          <PanelHeader
            icon={<FlagOutlined />}
            title="我关注的事项"
            extra={
              <Space size={6} wrap>
                <Tag>{followItems.length} 项</Tag>
                {followBlockedCount > 0 ? <Tag color="red">{followBlockedCount} 阻塞</Tag> : null}
                {followUrgentCount > 0 ? <Tag color="red">{followUrgentCount} 超期</Tag> : null}
              </Space>
            }
          />
          <div className="console-follow-list">
            {followItems.length > 0 ? (
				sortFollowItems(followItems).map((item) => (
					<FollowCard key={item.key} item={item} onView={handleFollowAction} />
				))
			) : (
				<div className="console-report-status-card">
					<p>{followsQuery.isError ? "关注事项加载失败" : "暂无关注事项"}</p>
					<Button type="link" onClick={() => navigate("/requirements")}>前往需求看板关注</Button>
				</div>
			)}
          </div>
        </div>

        <Row className="console-dashboard-hero-row" gutter={[14, 14]} align="stretch">
          <Col className="console-dashboard-hero-row__report" xs={24} xl={12}>
	          <ReportSection
	              title="今日报告"
	              icon={<FileTextOutlined />}
	              reports={personalReports}
	              summaryReports={summaryReports}
	              coverage={effectiveCoverage}
              variant="personal"
              onOpen={openReportModal}
              onViewReports={() => navigate("/reports")}
            />
          </Col>
          <Col className="console-dashboard-hero-row__token" xs={24} xl={12}>
            <SessionUploadCard
              range={tokenRange}
              report={tokenReport}
              loading={isTokenLoading}
              error={isTokenError}
              onRangeChange={setTokenRange}
              onViewDetail={() => navigate("/tokens")}
            />
          </Col>
        </Row>

        <div className="console-panel">
          <PanelHeader
            icon={<AlertOutlined />}
            title={`待处理风险 ${riskItems.length}`}
          />
          <div className="console-risk-list">
            {riskItems.length > 0 ? (
              sortRisks(riskItems).map((item) => (
                <RiskCard key={item.key} item={item} onAction={handleRiskAction} />
              ))
            ) : (
              <div className="console-report-status-card">
				<p>{risksQuery.isError ? "风险数据加载失败" : "暂无需要关注的风险"}</p>
                <Button type="link" onClick={() => navigate("/requirements")}>查看需求看板</Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <Modal
        className="console-report-workflow-modal"
        title={getReportModalTitle(activeReport, reportModalStep)}
        open={isReportModalOpen}
        width={getReportModalWidth(activeReport, reportModalStep)}
        footer={renderReportModalFooter({
          step: reportModalStep,
          report: activeReport,
          selectedCount: effectiveSelectedSessionIds.length,
          teamSubmittedCount: teamSourcesQuery.data?.submitted ?? 0,
          departmentSubmittedCount: departmentSourcesQuery.data?.submitted_team_count ?? 0,
          modifiedTaskCount,
          isSessionLoading: reportSessionsQuery.isLoading,
          isGenerating: draftMutation.isPending || teamGenerateMutation.isPending || departmentGenerateMutation.isPending,
          isSaving: saveReportMutation.isPending || saveTeamMutation.isPending || saveDepartmentMutation.isPending,
          onCancel: () => setIsReportModalOpen(false),
          onNext: startGenerateDraft,
          onGenerate: startGenerateDraft,
          onBack: goBackReportModalStep,
          onSave: saveDraft,
          onSend: sendReport
        })}
        onCancel={() => setIsReportModalOpen(false)}
      >
        <ReportModalContent
          step={reportModalStep}
          report={activeReport}
          coverage={effectiveCoverage}
          teamSources={teamSourcesQuery.data ?? null}
          teamSourcesLoading={teamSourcesQuery.isLoading}
          teamSourcesError={teamSourcesQuery.isError ? "成员日报收集情况加载失败" : null}
          departmentSources={departmentSourcesQuery.data ?? null}
          departmentSourcesLoading={departmentSourcesQuery.isLoading}
          departmentSourcesError={departmentSourcesQuery.isError ? "小组日报收集情况加载失败" : null}
          selectedSessionIds={effectiveSelectedSessionIds}
          selectedSkill={reportSkillDraft}
          skillOptions={reportSkillOptions}
          uploadedSkills={uploadedReportSkills}
          sessionOptions={sessionOptions}
          isSessionLoading={reportSessionsQuery.isLoading}
          sessionError={reportSessionsQuery.isError ? "Session 加载失败，请稍后重试" : null}
          draftError={draftError}
          taskSuggestions={taskSuggestions}
          draftMarkdown={effectiveDraftMarkdown}
          onSelectedSessionIdsChange={handleSelectedSessionIdsChange}
          onSelectedSkillChange={setReportSkillDraft}
          onSkillUpload={uploadReportSkill}
          onEditTask={openTaskEditModal}
          onDraftMarkdownChange={handleDraftMarkdownChange}
        />
      </Modal>
      <TaskProgressEditModal
        task={editingTaskDraft}
        open={Boolean(editingTaskDraft)}
        sessionOptions={sessionOptions}
        confirmLoading={applyTaskSuggestionMutation.isPending}
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
  summaryReports = [],
  coverage,
  variant,
  onOpen,
  onViewReports
}: {
  title: string;
  icon: ReactNode;
  reports: ReportItem[];
  summaryReports?: ReportItem[];
  coverage?: ReportCoverage;
  variant: "personal" | "summary";
  onOpen: (report: ReportItem, step?: ReportModalStep) => void;
  onViewReports: () => void;
}) {
  if (variant === "personal") {
    const dailyReport = reports.find((report) => report.kind === "personal_daily") ?? reports[0];
    const summaryDailyReport = summaryReports.find(
      (report) => report.kind === "team_daily" || report.kind === "department_daily"
    );
    const summaryWeeklyReport = summaryReports.find(
      (report) => report.kind === "team_weekly" || report.kind === "department_weekly"
    );

    return (
      <div className="console-panel console-panel--daily">
        <PanelHeader icon={icon} title={title} />
        <div className="console-report-status-card">
          <ReportTaskRow
            label="我的日报"
            report={dailyReport}
            description={getDailyReportCopy(dailyReport)}
            onOpen={onOpen}
          />
          {summaryDailyReport ? (
            <ReportTaskRow
              label={getSummaryReportLabel(summaryDailyReport)}
              report={summaryDailyReport}
              description={getSummaryDailyReportCopy(summaryDailyReport)}
              meta={coverage ? getCoverageSummary(summaryDailyReport, coverage) : undefined}
              emphasized
              onOpen={onOpen}
            />
          ) : null}
          <div className="console-report-shortcuts" aria-label="报告入口">
            <button type="button" className="console-report-shortcut" onClick={onViewReports}>
              <span>
                <FileTextOutlined />
                <strong>日报记录</strong>
              </span>
              <em>确认与归档记录</em>
              <RightOutlined />
            </button>
            {summaryDailyReport ? (
              <button type="button" className="console-report-shortcut" onClick={onViewReports}>
                <span>
                  <FileDoneOutlined />
                  <strong>{getSummaryRecordLabel(summaryDailyReport)}</strong>
                </span>
                <em>{summaryWeeklyReport ? getSummaryWeeklyRecordCopy(summaryWeeklyReport) : "汇总与历史报告"}</em>
                <RightOutlined />
              </button>
            ) : null}
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
            <div className="console-report-actions">{renderReportActions(report, onOpen)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportTaskRow({
  label,
  report,
  description,
  meta,
  emphasized,
  onOpen
}: {
  label: string;
  report: ReportItem;
  description: string;
  meta?: string;
  emphasized?: boolean;
  onOpen: (report: ReportItem, step?: ReportModalStep) => void;
}) {
  return (
    <section className={`console-report-task${emphasized ? " console-report-task--summary" : ""}`}>
      <div className="console-report-card-head">
        <Space size={8} wrap>
          <strong>{label}</strong>
          <ReportStatusTag status={report.status} />
        </Space>
        <div className="console-report-actions console-report-actions--head">
          {renderPrimaryReportAction(report, onOpen)}
        </div>
      </div>
      <p>{description}</p>
      {meta ? <span className="console-report-task__meta">{meta}</span> : null}
    </section>
  );
}

function renderReportActions(
  report: ReportItem,
  onOpen: (report: ReportItem, step?: ReportModalStep) => void
) {
  if (report.status === "待生成") {
    return (
      <Button type="primary" icon={<FileDoneOutlined />} onClick={() => onOpen(report, getGenerateStepForReport(report))}>
        查看并生成
      </Button>
    );
  }

  if (report.status === "生成中") {
    return <Button disabled>生成中</Button>;
  }

  if (report.status === "生成失败") {
    return (
      <Button type="primary" icon={<FileDoneOutlined />} onClick={() => onOpen(report, getGenerateStepForReport(report))}>
        查看并生成
      </Button>
    );
  }

  if (report.status === "草稿待确认") {
    return (
      <>
        <Button icon={<EditOutlined />} onClick={() => onOpen(report, "editor")}>
          确认{getReportActionNoun(report)}
        </Button>
      </>
    );
  }

  if (report.status === "已归档") {
    return (
      <Button icon={<EditOutlined />} onClick={() => onOpen(report, "editor")}>
        编辑{getReportActionNoun(report)}
      </Button>
    );
  }

  return (
    <Button icon={<EditOutlined />} onClick={() => onOpen(report, "editor")}>
      查看{getReportActionNoun(report)}
    </Button>
  );
}

function renderPrimaryReportAction(
  report: ReportItem,
  onOpen: (report: ReportItem, step?: ReportModalStep) => void
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
        {report.scope === "department" ? "编辑部门日报" : `确认${getReportActionNoun(report)}`}
      </Button>
    );
  }

  if (report.status === "已归档") {
    return (
      <Button
        className="console-report-primary-action console-report-primary-action--quiet"
        icon={<EditOutlined />}
        onClick={() => onOpen(report, "editor")}
      >
        {report.scope === "department" ? "编辑部门日报" : `编辑${getReportActionNoun(report)}`}
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
      {report.scope === "department"
        ? "查看收集情况"
        : report.status === "生成失败"
          ? `查看并生成${getReportActionNoun(report)}`
          : `查看并生成${getReportActionNoun(report)}`}
    </Button>
  );
}

function getReportActionNoun(report: ReportItem) {
  if (report.scope === "team") return "组报";
  if (report.scope === "department") return "部门报告";
  return "日报";
}

function getDailyReportCopy(report: ReportItem) {
  if (report.status === "草稿待确认") {
    return "已根据今日 AI 工作记录生成日报，确认内容后即可发送。";
  }

  if (report.status === "已归档") {
    return "今日日报已归档，可回看内容和关联的工作记录。";
  }

  if (report.status === "生成中") {
    return "正在根据今日 AI 工作记录生成日报。";
  }

  return "选择今日 AI 工作记录，生成可确认的日报。";
}

function getSummaryReportLabel(report: ReportItem) {
  return report.scope === "department" ? "部门报告" : "组报告";
}

function getSummaryRecordLabel(report: ReportItem) {
  return report.scope === "department" ? "部门报告记录" : "组报记录";
}

function getSummaryDailyReportCopy(report: ReportItem) {
  if (report.status === "草稿待确认") {
    return report.scope === "department"
      ? "部门日报草稿已生成，内容基于已提交的小组日报。"
      : `${getReportActionNoun(report)}已生成，确认后即可归档。`;
  }

  if (report.status === "已归档") {
    return `${getReportActionNoun(report)}已归档，可回看按组来源和汇总内容。`;
  }

  if (report.status === "生成中") {
    return `正在汇总成员报告、任务风险和阻塞情况。`;
  }

  if (report.status === "生成失败") {
    return `${getReportActionNoun(report)}生成失败，请根据提交覆盖情况重新生成。`;
  }

  return report.scope === "department"
    ? "先查看各小组已提交日报和未提交小组，再生成部门日报草稿。"
    : "查看组内成员日报收集情况后生成组报。";
}

function getCoverageSummary(report: ReportItem, coverage: ReportCoverage) {
  if (report.scope === "department") {
    return `${coverage.submitted}/${coverage.expected} 已提交 · ${coverage.missing} 组未提交`;
  }

  return `${coverage.submitted}/${coverage.expected} 已提交 · ${coverage.missing} 人未提交`;
}

function getSummaryWeeklyRecordCopy(report: ReportItem) {
  return report.scope === "department" ? "部门汇总与历史报告" : "组内汇总与历史组报";
}

function getInitialReportModalStep(report: ReportItem): ReportModalStep {
  if (report.status === "草稿待确认" || report.status === "已归档") {
    return "editor";
  }

  return getGenerateStepForReport(report);
}

function getGenerateStepForReport(report: ReportItem): ReportModalStep {
  return report.kind === "personal_daily" ? "sessions" : "source";
}

function getReportModalTitle(report: ReportItem, step: ReportModalStep) {
  if (report.kind === "department_daily") {
    return step === "editor" ? "编辑部门日报" : "生成部门日报";
  }
  if (step === "editor") {
    return `编辑${report.name}`;
  }

  return `生成${report.name}`;
}

function getReportModalWidth(report: ReportItem, step: ReportModalStep) {
  if (step === "editor") return 860;
  if (report.kind === "team_daily") return 840;
  return 720;
}

function SessionUploadCard({
  range,
  report,
  loading,
  error,
  onRangeChange,
  onViewDetail
}: {
  range: TokenRange;
  report: TokenReport;
  loading: boolean;
  error: boolean;
  onRangeChange: (range: TokenRange) => void;
  onViewDetail: () => void;
}) {
  return (
    <div className="console-panel console-panel--token">
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
        {loading ? (
          <div className="console-token-state">Token 数据加载中...</div>
        ) : error ? (
          <div className="console-token-state is-error">Token 数据加载失败</div>
        ) : report.sessions === 0 ? (
          <div className="console-token-state">当前范围暂无 Token 数据</div>
        ) : (
          renderSessionUploadSummary(range, report)
        )}
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
      <div className="console-token-scope">
        <TokenPersonalSummary range={range} report={report} />
        <div className="console-token-scope-main">
          <div className="console-token-scope-head">
            <span>各组 Token</span>
            <strong>{report.total}</strong>
            <em>{report.sessions} 个 session · {report.groups.length} 个组已上报</em>
          </div>
          <TokenGroupBars groups={report.groups} />
        </div>
      </div>
    );
  }

  if (typeof report.uploaders === "number") {
    return (
      <div className="console-token-scope">
        <TokenPersonalSummary range={range} report={report} />
        <div className="console-token-scope-main">
          <div className="console-token-scope-head">
            <span>本组 Token</span>
            <strong>{report.total}</strong>
            <em>{report.sessions} 个 session · {report.uploaders} 人已上报</em>
          </div>
          <TokenMetricBars bars={report.bars} />
        </div>
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

function TokenPersonalSummary({ range, report }: { range: TokenRange; report: TokenReport }) {
  const sessions = report.mine?.sessions ?? report.sessions;
  const total = report.mine?.total ?? report.total;

  return (
    <div className="console-token-personal">
      <span>
        <strong>我的 Token</strong>
        <em>{getTokenRangeLabel(range)} · {sessions} 个 session</em>
      </span>
      <b>{total}</b>
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

function TokenMetricBars({ bars }: { bars: TokenReport["bars"] }) {
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="console-token-metric-bars" aria-label="Token 上报摘要">
      {bars.map((bar) => (
        <div key={bar.label} className="console-token-metric-bars__item">
          <span>{bar.label}</span>
          <i>
            <b style={{ width: `${Math.max(8, Math.round((bar.value / maxValue) * 100))}%` }} />
          </i>
          <em>{bar.text}</em>
        </div>
      ))}
    </div>
  );
}

function TokenGroupBars({ groups }: { groups: NonNullable<TokenReport["groups"]> }) {
  const maxValue = Math.max(...groups.map((group) => group.value), 1);

  return (
    <div className="console-token-group-bars" aria-label="Token 分组分布">
      {groups.map((group) => (
        <div key={group.name} className="console-token-group-bars__item">
          <span>
            <strong>{group.name}</strong>
            {group.note ? <small title={group.note}>{group.note}</small> : null}
          </span>
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
* 部门日报需要基于已提交小组日报确认后归档。

## 明日重点
* 跟进高优先级风险和跨组依赖。`;
  }

  return DEFAULT_MARKDOWN;
}

function getReportSourceSteps(report: ReportItem) {
  if (report.kind === "personal_daily") {
    return [{ title: "选择 session" }, { title: "编辑内容" }];
  }

  return [{ title: "确认来源" }, { title: "编辑内容" }];
}

function getReportSourceTitle(report: ReportItem) {
  if (report.scope === "team") return "查看成员日报收集情况";
  if (report.scope === "department") return "查看小组日报收集情况";
  return "生成个人周报";
}

function getReportSourceMeta(report: ReportItem, coverage?: ReportCoverage) {
  if (report.scope === "team" && coverage) {
    return `成员提交情况：应提交 ${coverage.expected}，已提交 ${coverage.submitted}，未提交 ${coverage.missing}`;
  }

  if (report.scope === "department" && coverage) {
    return `各组提交情况：应提交 ${coverage.expected}，已提交 ${coverage.submitted}，未提交 ${coverage.missing}`;
  }

  return "系统将读取本周个人日报、任务、风险与阻塞生成草稿。";
}

function getEditorMeta(report: ReportItem) {
  if (report.kind === "personal_daily") {
    return [`已选 ${report.sessionCount} 个 session`, report.skill];
  }

  if (report.kind === "department_daily") {
    return [`本草稿基于 ${report.sessionCount} 个已提交小组日报生成`, "来源：小组日报"];
  }

  if (report.kind === "team_daily") {
    return [`本草稿基于 ${report.sessionCount} 份已提交成员日报生成`, "来源：成员原始日报"];
  }

  return [report.sourceSummary, report.skill];
}

function getSendButtonText(report: ReportItem) {
  if (report.scope === "team") return report.kind.includes("weekly") ? "归档组周报" : "提交给总监";
  if (report.scope === "department") return "保存归档";
  return report.kind.includes("weekly") ? "归档周报" : "保存日报";
}

function renderReportModalFooter({
  step,
  report,
  selectedCount,
  teamSubmittedCount,
  departmentSubmittedCount,
  modifiedTaskCount,
  isSessionLoading,
  isGenerating,
  isSaving,
  onCancel,
  onNext,
  onGenerate,
  onBack,
  onSave,
  onSend
}: {
  step: ReportModalStep;
  report: ReportItem;
  selectedCount: number;
  teamSubmittedCount: number;
  departmentSubmittedCount: number;
  modifiedTaskCount: number;
  isSessionLoading: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onNext: () => void;
  onGenerate: () => void;
  onBack: () => void;
  onSave: () => void;
  onSend: () => void;
}) {
  if (step === "sessions") {
    return (
      <Space>
        <Button onClick={onCancel} disabled={isGenerating}>稍后处理</Button>
        <Button
          type="primary"
          disabled={selectedCount === 0 || isSessionLoading}
          loading={isGenerating}
          onClick={onNext}
        >
          下一步
        </Button>
      </Space>
    );
  }

  if (step === "source") {
    return (
      <Space>
        <Button onClick={onCancel}>稍后处理</Button>
        <Button
          type="primary"
          loading={isGenerating}
          disabled={
            (report.kind === "department_daily" && departmentSubmittedCount === 0) ||
            (report.kind === "team_daily" && teamSubmittedCount === 0)
          }
          onClick={onGenerate}
        >
          {report.kind === "department_daily"
            ? "基于已提交组日报生成草稿"
            : report.kind === "team_daily"
              ? "基于已提交成员日报生成草稿"
              : "生成草稿"}
        </Button>
      </Space>
    );
  }

  return (
    <Space>
      {modifiedTaskCount > 0 ? (
        <span className="console-report-footer-note">
          已修改 {modifiedTaskCount} 个任务，保存日报后同步任务进展。
        </span>
      ) : null}
      <Button onClick={onBack} disabled={isSaving}>上一步</Button>
      <Button onClick={onSave} loading={isSaving}>保存修改</Button>
      <Button type="primary" icon={<FileDoneOutlined />} loading={isSaving} onClick={onSend}>
        {getSendButtonText(report)}
      </Button>
    </Space>
  );
}

function TaskProgressSuggestionList({
  tasks,
  sessionOptions,
  onEditTask
}: {
  tasks: TaskProgressSuggestion[];
  sessionOptions: SessionOption[];
  onEditTask: (task: TaskProgressSuggestion) => void;
}) {
  const sessionTitleById = new Map(sessionOptions.map((session) => [session.value, `${session.tool} ${session.timeRange}`]));
  return (
    <aside className="console-task-suggestion-list">
      <div className="console-session-modal__section">
        <strong>任务进展建议</strong>
        <span>LLM 根据已选 session 生成 {tasks.length} 条建议，可按需修改。</span>
      </div>
      <div className="console-task-suggestion-scroll">
        {tasks.length === 0 ? (
          <div className="console-task-suggestion-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务进展建议" />
          </div>
        ) : tasks.map((task) => (
          <article key={task.key} className="console-task-suggestion-card">
            <div className="console-task-suggestion-card__top">
              <strong>{task.taskName}</strong>
              <Button size="small" onClick={() => onEditTask(task)}>编辑任务</Button>
            </div>
            <div className="console-task-suggestion-card__meta">
              <Tag color="blue">{getTaskStatusLabel(task.status)}</Tag>
              <span>建议进度 {task.progress}%</span>
              <span>{task.sessionIds.length} 个 session</span>
            </div>
            <ul>
              {task.sessionIds.map((sessionId, index) => (
                <li key={sessionId}>
                  {task.evidenceSessionTitles[index] ?? sessionTitleById.get(sessionId) ?? sessionId}
                </li>
              ))}
            </ul>
            {task.note ? <p>{task.note}</p> : null}
            {task.syncState ? <Tag className="console-task-suggestion-card__sync" color="blue">{task.syncState}</Tag> : null}
          </article>
        ))}
      </div>
    </aside>
  );
}

function getUploadedSkillName(fileName: string, content: string) {
  const frontmatterName = content.match(/^\s*name:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim();
  const baseName = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const rawName = frontmatterName || baseName || "上传 Skill";

  return /skill/i.test(rawName) || rawName.includes("Skill") ? rawName : `${rawName} Skill`;
}

function getDashboardRole(role?: UserRole | null): DashboardRole {
  if (role === "admin") return "director";
  if (role === "director" || role === "pm" || role === "team_leader" || role === "employee") return role;
  return "employee";
}

function toSessionOption(session: Session): SessionOption {
  const started = formatDateTime(session.started_at, "HH:mm");
  const ended = session.ended_at ? formatDateTime(session.ended_at, "HH:mm") : "";
  const timeRange = ended && ended !== "-" ? `${started} - ${ended}` : started;
  return {
    tool: getAgentLabel(session.agent_type),
    timeRange: timeRange === "-" ? "时间未知" : timeRange,
    summary: session.summary || session.task_title || session.session_ref,
    value: session.id,
    recommended: true
  };
}

function getAgentLabel(agentType: string) {
  if (agentType === "codex") return "Codex session";
  if (agentType === "claude_code") return "Claude Code session";
  return `${agentType || "AI"} session`;
}

function mapDraftTaskSuggestion(item: DraftTaskProgressSuggestion): TaskProgressSuggestion {
  return {
    key: item.task_id,
    taskId: item.task_id,
    taskName: item.task_title,
    progress: clampTaskProgress(item.suggested_progress),
    status: item.suggested_status,
    sessionIds: item.evidence_session_ids,
    evidenceSessionTitles: item.evidence_session_titles,
    note: item.reason
  };
}

function clampTaskProgress(progress: number) {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function getTaskStatusLabel(status: DraftTaskStatus) {
  if (status === "done") return "已完成";
  if (status === "in_progress") return "进行中";
  return "未开始";
}

function TaskProgressEditModal({
  task,
  open,
  sessionOptions,
  confirmLoading,
  onCancel,
  onChange,
  onSave
}: {
  task: TaskProgressSuggestion | null;
  open: boolean;
  sessionOptions: SessionOption[];
  confirmLoading: boolean;
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
          <Button onClick={onCancel} disabled={confirmLoading}>取消</Button>
          <Popconfirm
            title="确认更新任务进展？"
            description="确认后会调用任务接口更新状态或进度。"
            okText="确认更新"
            cancelText="取消"
            onConfirm={onSave}
          >
            <Button type="primary" loading={confirmLoading}>确认更新任务</Button>
          </Popconfirm>
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
            options={[0, 25, 50, 75, 100].map((value) => ({ label: `${value}%`, value }))}
            onChange={(progress) => onChange({ ...task, progress })}
          />
        </label>
        <label>
          <span>状态：</span>
          <Select
            value={task.status}
            options={[
              { label: "未开始", value: "todo" },
              { label: "进行中", value: "in_progress" },
              { label: "已完成", value: "done" }
            ]}
            onChange={(status) => onChange({ ...task, status: status as DraftTaskStatus })}
          />
        </label>
        <div className="console-session-modal__section">
          <strong>关联 session：</strong>
          <Checkbox.Group
            value={task.sessionIds}
            onChange={(value) => {
              const sessionIds = value as string[];
              onChange({
                ...task,
                sessionIds,
                evidenceSessionTitles: sessionIds.map((sessionId) => {
                  const session = sessionOptions.find((item) => item.value === sessionId);
                  return session ? `${session.tool} ${session.timeRange}` : sessionId;
                })
              });
            }}
          >
            <div className="console-task-edit-sessions">
              {sessionOptions.map((session) => (
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
  teamSources,
  teamSourcesLoading,
  teamSourcesError,
  departmentSources,
  departmentSourcesLoading,
  departmentSourcesError,
  selectedSessionIds,
  selectedSkill,
  skillOptions,
  uploadedSkills,
  sessionOptions,
  isSessionLoading,
  sessionError,
  draftError,
  taskSuggestions,
  draftMarkdown,
  onSelectedSessionIdsChange,
  onSelectedSkillChange,
  onSkillUpload,
  onEditTask,
  onDraftMarkdownChange
	}: {
	  step: ReportModalStep;
	  report: ReportItem;
	  coverage: ReportCoverage;
  teamSources: TeamReportSources | null;
  teamSourcesLoading: boolean;
  teamSourcesError: string | null;
  departmentSources: DepartmentReportSources | null;
  departmentSourcesLoading: boolean;
  departmentSourcesError: string | null;
	  selectedSessionIds: string[];
  selectedSkill: string;
  skillOptions: ReportSkillOption[];
  uploadedSkills: ReportSkillOption[];
  sessionOptions: SessionOption[];
  isSessionLoading: boolean;
  sessionError: string | null;
  draftError: string | null;
  taskSuggestions: TaskProgressSuggestion[];
  draftMarkdown: string;
  onSelectedSessionIdsChange: (value: string[]) => void;
  onSelectedSkillChange: (value: string) => void;
  onSkillUpload: (file: File) => boolean;
	  onEditTask: (task: TaskProgressSuggestion) => void;
	  onDraftMarkdownChange: (value: string) => void;
}) {
  const [expandedTeamReportUserId, setExpandedTeamReportUserId] = useState<string | null>(null);
  const [expandedDepartmentReportId, setExpandedDepartmentReportId] = useState<string | null>(null);

  if (step === "sessions") {
    return (
      <div className="console-report-modal">
        <Steps
          size="small"
          current={0}
          items={getReportSourceSteps(report)}
        />
        <div className="console-session-modal__section">
          <strong>选择生成来源</strong>
          <span>
            {isSessionLoading
              ? "正在加载今日已上传 session。"
              : `已找到 ${sessionOptions.length} 个 session，默认勾选今日全部记录。`}
          </span>
        </div>
        {sessionError ? (
          <Alert type="error" showIcon message={sessionError} />
        ) : null}
        {draftError ? (
          <Alert type="error" showIcon message="日报草稿生成失败" description={draftError} />
        ) : null}
        <Checkbox.Group value={selectedSessionIds} onChange={(value) => onSelectedSessionIdsChange(value as string[])}>
          <div className="console-session-list">
            {isSessionLoading ? (
              <div className="console-session-empty">正在加载 session...</div>
            ) : sessionOptions.length === 0 ? (
              <div className="console-session-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="今日暂无已上传 session" />
              </div>
            ) : sessionOptions.map((session) => (
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
        <GenerationSettingsPanel
          selectedSkill={selectedSkill}
          skillOptions={skillOptions}
          uploadedSkills={uploadedSkills}
          onSelectedSkillChange={onSelectedSkillChange}
          onSkillUpload={onSkillUpload}
        />
      </div>
    );
  }

	  if (step === "source") {
    if (report.kind === "department_daily") {
      return (
        <div className="console-report-modal">
          <Steps
            size="small"
            current={0}
            items={getReportSourceSteps(report)}
          />
          <DepartmentSourceReview
            sources={departmentSources}
            loading={departmentSourcesLoading}
            error={departmentSourcesError}
            expandedReportId={expandedDepartmentReportId}
            onExpandedReportIdChange={setExpandedDepartmentReportId}
          />
          {draftError ? (
            <Alert type="error" showIcon message="部门日报草稿生成失败" description={draftError} />
          ) : null}
        </div>
      );
    }

    if (report.kind === "team_daily") {
      return (
        <div className="console-report-modal">
          <Steps
            size="small"
            current={0}
            items={getReportSourceSteps(report)}
          />
          <TeamSourceReview
            sources={teamSources}
            loading={teamSourcesLoading}
            error={teamSourcesError}
            expandedUserId={expandedTeamReportUserId}
            onExpandedUserIdChange={setExpandedTeamReportUserId}
          />
          <details className="console-generation-settings-disclosure">
            <summary>高级配置</summary>
            <GenerationSettingsPanel
              selectedSkill={selectedSkill}
              skillOptions={skillOptions}
              uploadedSkills={uploadedSkills}
              onSelectedSkillChange={onSelectedSkillChange}
              onSkillUpload={onSkillUpload}
              compact
            />
          </details>
          {draftError ? (
            <Alert type="error" showIcon message="小组日报草稿生成失败" description={draftError} />
          ) : null}
        </div>
      );
    }

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
        <GenerationSettingsPanel
          selectedSkill={selectedSkill}
          skillOptions={skillOptions}
          uploadedSkills={uploadedSkills}
          onSelectedSkillChange={onSelectedSkillChange}
          onSkillUpload={onSkillUpload}
          compact
        />
      </div>
    );
  }

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
          onChange={(event) => onDraftMarkdownChange(event.target.value)}
        />
        {report.kind === "personal_daily" ? (
          <TaskProgressSuggestionList
            tasks={taskSuggestions}
            sessionOptions={sessionOptions}
            onEditTask={onEditTask}
          />
        ) : null}
      </div>
    </div>
  );
	}

function TeamSourceReview({
  sources,
  loading,
  error,
  expandedUserId,
  onExpandedUserIdChange
}: {
  sources: TeamReportSources | null;
  loading: boolean;
  error: string | null;
  expandedUserId: string | null;
  onExpandedUserIdChange: (id: string | null) => void;
}) {
  if (loading) {
    return <div className="console-session-empty">正在加载成员原始日报收集情况...</div>;
  }

  if (error) {
    return <Alert type="error" showIcon message={error} />;
  }

  if (!sources) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成员日报收集数据" />;
  }

  const members = sources.members;
  const total = members.length;
  const submitted = sources.submitted ?? members.filter((member) => member.has_report).length;
  const missing = sources.missing ?? total - submitted;
  const edited = members.filter((member) => member.has_report && member.content.trim().length > 0).length;

  return (
    <div className="console-department-source">
      <div className="console-session-modal__section">
        <strong>确认成员原始日报来源</strong>
        <span>
          {sources.team_name} · {sources.report_date} · 已收集 {submitted}/{total} 份成员日报，
          {missing} 人未提交。
        </span>
      </div>

      <div className="console-team-source__stats" aria-label="成员日报提交统计">
        <span><strong>{total}</strong><em>成员总数</em></span>
        <span><strong>{submitted}</strong><em>今日已交</em></span>
        <span><strong>{missing}</strong><em>今日未交</em></span>
        <span><strong>{edited}</strong><em>已编辑</em></span>
      </div>

      <section className="console-department-source__block console-team-source__block">
        <div className="console-department-source__head">
          <strong>成员原始日报</strong>
          <Tag color={missing > 0 ? "gold" : "green"}>{submitted}/{total} 已提交</Tag>
        </div>
        {members.length === 0 ? (
          <div className="console-session-empty">暂无团队成员</div>
        ) : (
          <div className="console-team-source__list">
            {members.map((member) => {
              const expanded = expandedUserId === member.user_id;

              return (
                <article
                  key={member.user_id}
                  className={`console-team-source__item ${member.has_report ? "" : "is-missing"}`}
                >
                  <div className="console-team-source__row">
                    <div className="console-team-source__member">
                      <strong title={member.user_name}>{member.user_name}</strong>
                      <Tag color={member.has_report ? "blue" : "gold"} bordered={false}>
                        {member.has_report ? "已提交" : "未提交"}
                      </Tag>
                    </div>
                    <div className="console-team-source__actions">
                      <time>{member.submitted_at ? formatDateTime(member.submitted_at, "HH:mm") : "未提交"}</time>
                      {member.has_report ? (
                        <Button
                          size="small"
                          onClick={() => onExpandedUserIdChange(expanded ? null : member.user_id)}
                        >
                          {expanded ? "收起原文" : "查看原文"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {expanded ? (
                    <pre className="console-department-source__content console-team-source__content">
                      {member.content || "暂无内容"}
                    </pre>
                  ) : !member.has_report ? (
                    <p className="console-team-source__missing-note">成员今日尚未提交原始日报。</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DepartmentSourceReview({
  sources,
  loading,
  error,
  expandedReportId,
  onExpandedReportIdChange
}: {
  sources: DepartmentReportSources | null;
  loading: boolean;
  error: string | null;
  expandedReportId: string | null;
  onExpandedReportIdChange: (id: string | null) => void;
}) {
  if (loading) {
    return <div className="console-session-empty">正在加载小组日报收集情况...</div>;
  }

  if (error) {
    return <Alert type="error" showIcon message={error} />;
  }

  if (!sources) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无小组日报收集数据" />;
  }

  const submitted = sources.submitted_team_reports;
  const missing = sources.missing_teams;

  return (
    <div className="console-department-source">
      <div className="console-session-modal__section">
        <strong>确认小组日报来源</strong>
        <span>
          已收集 {sources.submitted_team_count}/{sources.total_team_count} 个小组日报，
          {missing.length} 个小组未提交。
        </span>
      </div>

      <section className="console-department-source__block">
        <div className="console-department-source__head">
          <strong>已提交小组</strong>
          <Tag color="blue">{submitted.length} 组</Tag>
        </div>
        {submitted.length === 0 ? (
          <div className="console-session-empty">暂无已提交小组日报</div>
        ) : (
          <div className="console-department-source__list">
            {submitted.map((item) => {
              const reportId = item.team_report_id ?? item.report_id ?? item.team_id;
              const expanded = expandedReportId === reportId;
              return (
                <article key={reportId} className="console-department-source__item">
                  <div className="console-department-source__row">
                    <span>
                      <strong>{item.team_name}</strong>
                      <em>{item.team_leader_name || item.leader_name || "未记录 TL"}</em>
                    </span>
                    <span>
                      <time>{item.submitted_at ? formatDateTime(item.submitted_at, "HH:mm") : "-"}</time>
                      <Button
                        size="small"
                        onClick={() => onExpandedReportIdChange(expanded ? null : reportId)}
                      >
                        {expanded ? "收起原文" : "查看原文"}
                      </Button>
                    </span>
                  </div>
                  {expanded ? (
                    <pre className="console-department-source__content">{item.content || "暂无内容"}</pre>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="console-department-source__block">
        <div className="console-department-source__head">
          <strong>未提交小组</strong>
          <Tag color={missing.length > 0 ? "gold" : "green"}>{missing.length} 组</Tag>
        </div>
        {missing.length === 0 ? (
          <div className="console-session-empty">所有小组均已提交</div>
        ) : (
          <div className="console-department-source__missing">
            {missing.map((team) => (
              <Tag key={team.team_id} color="gold">{team.team_name}</Tag>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GenerationSettingsPanel({
  selectedSkill,
  skillOptions,
  uploadedSkills,
  onSelectedSkillChange,
  onSkillUpload,
  compact
}: {
  selectedSkill: string;
  skillOptions: ReportSkillOption[];
  uploadedSkills: ReportSkillOption[];
  onSelectedSkillChange: (value: string) => void;
  onSkillUpload: (file: File) => boolean;
  compact?: boolean;
}) {
  const selectedSkillLabel = skillOptions.find((option) => option.value === selectedSkill)?.label ?? selectedSkill;
  return (
    <section className={`console-generation-settings${compact ? " console-generation-settings--compact" : ""}`}>
      <div className="console-generation-settings__head">
        <span>
          <strong>Skill 预设</strong>
          <em>选择日报生成口径；上传 skill.md 后会加入预设，并用于本次生成。</em>
        </span>
        <Tag color="blue">{selectedSkillLabel}</Tag>
      </div>
      <div className="console-generation-settings__body">
        <label>
          <span>当前预设</span>
          <Select
            value={selectedSkill}
            options={skillOptions.map((option) => ({
              label: option.label,
              value: option.value
            }))}
            popupMatchSelectWidth={false}
            onChange={onSelectedSkillChange}
          />
        </label>
        <div className="console-generation-settings__upload">
          <span>上传预设</span>
          <Upload
            accept=".md,text/markdown"
            beforeUpload={(file) => onSkillUpload(file)}
            maxCount={1}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>上传 skill.md</Button>
          </Upload>
        </div>
      </div>
      {uploadedSkills.length > 0 ? (
        <div className="console-generation-settings__presets" aria-label="已上传 Skill">
          {uploadedSkills.map((skill) => (
            <Tag key={skill.value} color={skill.value === selectedSkill ? "blue" : "default"}>
              {skill.label}
            </Tag>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReportStatusTag({ status }: { status: ReportStatus }) {
  const color =
    status === "已归档"
      ? "green"
      : status === "生成失败"
        ? "red"
        : status === "草稿待确认" || status === "生成中"
          ? "blue"
          : "gold";
  const label = status === "草稿待确认" ? "待确认" : status;
  return <Tag color={color}>{label}</Tag>;
}

function FollowCard({ item, onView }: { item: FollowItem; onView: (item: FollowItem) => void }) {
  const isTask = item.type === "任务";
  const tone = getFollowTone(item);

  return (
    <article className={`console-follow-card console-follow-card--${tone}`}>
      <span className="console-follow-card__rail" aria-hidden="true" />
      <div className="console-follow-card__main">
        <Space size={8} wrap>
          <Tag color={isTask ? "geekblue" : "green"}>{item.type}</Tag>
          <Badge status={item.status === "阻塞" ? "error" : "processing"} text={item.status} />
        </Space>
      </div>
      <strong className="console-follow-card__title">{item.title}</strong>
      <div className="console-follow-card__change">
        <Tag color={tone === "red" ? "red" : "blue"}>{item.risk}</Tag>
        {item.activity ? <span>{item.activity}</span> : null}
      </div>
      <div className="console-follow-card__meta">
        <span>
          <ClockCircleOutlined /> {item.owner} · {item.deadline}
        </span>
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

function getFollowTone(item: FollowItem): "red" | "orange" | "blue" {
  if (item.risk.includes("阻塞") || item.status === "阻塞" || item.risk.includes("超期")) return "red";
  if (item.risk.includes("依赖")) return "orange";
  return "blue";
}

function sortFollowItems(items: FollowItem[]) {
  return [...items].sort((a, b) => getFollowPriority(a) - getFollowPriority(b));
}

function getFollowPriority(item: FollowItem) {
  if (item.risk.includes("超期") || item.risk.includes("已超期")) return 1;
  if (item.risk.includes("依赖") || item.status === "阻塞") return 2;
  if (item.status === "进行中") return 4;
  if (item.status === "已完成") return 9;
  return 5;
}

function RiskCard({ item, onAction }: { item: RiskItem; onAction: (item: RiskItem) => void }) {
  return (
    <article className={`console-risk-card console-risk-card--${item.tone}`}>
      <span className="console-risk-card__rail" aria-hidden="true" />
      <div className="console-risk-card__main">
        <span className={`console-risk-tag console-risk-tag--${item.tone}`}>{item.level} · {item.source}</span>
        <strong>{item.title}</strong>
        <span>{item.reason}</span>
      </div>
      <div className="console-risk-card__impact">
        <em>影响对象</em>
        <span>{item.target}</span>
      </div>
      <div className="console-risk-card__meta">
        <span>{item.owner}</span>
        <span>
          <ClockCircleOutlined /> {item.deadline}
        </span>
      </div>
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
