import assert from "node:assert/strict";

const state = {
  user: { id: "user-1", name: "张三" },
  sessions: [
    {
      id: "session-1",
      user_id: "user-1",
      title: "Claude Code session 09:30 - 10:20",
      summary: "完成 Dashboard 生成日报弹窗真实 session 接入"
    },
    {
      id: "session-2",
      user_id: "user-1",
      title: "Codex session 14:00 - 15:10",
      summary: "补充 draft API 和任务进展建议"
    }
  ],
  tasks: [
    {
      id: "task-1",
      title: "控制台日报交互设计",
      requirement_id: "req-1",
      requirement_title: "日报入口状态优化",
      status: "in_progress",
      progress: 40
    }
  ],
  dailyReports: []
};

function generateDraft({ userId, sessionIds, includeTaskProgress }) {
  const selectedSessions = state.sessions.filter(
    (session) => session.user_id === userId && sessionIds.includes(session.id)
  );
  assert.equal(selectedSessions.length, sessionIds.length, "all selected sessions must belong to user");

  return {
    report_markdown:
      "# 6 月 24 日日报\n\n## 今日完成\n- 完成 Dashboard 生成日报弹窗真实 session 接入。\n- 补充 draft API 和任务进展建议。\n\n## 风险与阻塞\n暂无。\n\n## 明日计划\n继续进行联调和验收。",
    selected_session_ids: selectedSessions.map((session) => session.id),
    skill_name: "默认日报 Skill",
    task_progress_suggestions: includeTaskProgress
      ? [
          {
            task_id: "task-1",
            task_title: "控制台日报交互设计",
            requirement_id: "req-1",
            requirement_title: "日报入口状态优化",
            suggested_status: "in_progress",
            suggested_progress: 75,
            evidence_session_ids: ["session-1", "session-2"],
            evidence_session_titles: selectedSessions.map((session) => session.title),
            reason: "两个 session 明确覆盖了弹窗真实数据接入和 draft API 联调。"
          }
        ]
      : []
  };
}

function saveReport({ userId, reportDate, content, sessionIds }) {
  state.dailyReports = state.dailyReports.filter(
    (report) => !(report.user_id === userId && report.report_date === reportDate)
  );
  state.dailyReports.push({
    user_id: userId,
    report_date: reportDate,
    content,
    session_ids: sessionIds
  });
}

function applyTaskSuggestion(suggestion) {
  const task = state.tasks.find((item) => item.id === suggestion.task_id);
  assert.ok(task, "task must exist before applying suggestion");
  task.status = suggestion.suggested_status;
  task.progress = suggestion.suggested_progress;
}

const beforeTask = { ...state.tasks[0] };
const draft = generateDraft({
  userId: state.user.id,
  sessionIds: ["session-1", "session-2"],
  includeTaskProgress: true
});

assert.ok(draft.report_markdown.includes("今日完成"), "draft markdown should be generated");
assert.deepEqual(draft.selected_session_ids, ["session-1", "session-2"]);
assert.equal(draft.task_progress_suggestions.length, 1);
assert.deepEqual(state.tasks[0], beforeTask, "draft generation must not update task");

saveReport({
  userId: state.user.id,
  reportDate: "2026-06-24",
  content: draft.report_markdown,
  sessionIds: draft.selected_session_ids
});

assert.equal(state.dailyReports.length, 1);
assert.deepEqual(state.dailyReports[0].session_ids, ["session-1", "session-2"]);
assert.deepEqual(state.tasks[0], beforeTask, "saving report must not update task");

applyTaskSuggestion(draft.task_progress_suggestions[0]);

assert.equal(state.tasks[0].status, "in_progress");
assert.equal(state.tasks[0].progress, 75);

console.log("P0 report draft simulated workflow passed");
