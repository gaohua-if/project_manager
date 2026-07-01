#!/usr/bin/env python3
"""Seed 7 days of test sessions for all 12 test accounts.

Each user gets one session per day for 2026-06-25..2026-07-01, with a
clearly dated + labeled summary, token usage, and a small JSONL raw log
attachment so the DownloadLog flow works too.

Run:  python3 scripts/seed_test_sessions.py
"""

import json
import mimetypes
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib import request as urlreq

API_BASE = "http://127.0.0.1:18090/api/v1"
TODAY = datetime(2026, 7, 1, tzinfo=timezone.utc)
DAYS = [TODAY - timedelta(days=i) for i in range(6, -1, -1)]  # 06-25 .. 07-01

# uid, username, nickname, team, role, token
USERS = [
    (303, "t01", "测试01", "", "pm", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMwMywiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.NkFDwsjc2gRZE9ME4lwPh1aJGkyQDKM7WyZhr3I1LLo"),
    (304, "t02", "测试02", "", "director", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMwNCwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.uxqNFtJ1oPW4pxABCb5eEISSKv94Iy76iA6-jOQ3qPQ"),
    (305, "t03", "测试03", "小组A", "team_leader", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMwNSwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.npIEJHn2eiQZmlY_8WE7KEBL6GTrv6Ygx3eAVEVCoF4"),
    (306, "t04", "测试04", "小组B", "team_leader", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMwNiwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.6JNBc9J7YgEXjmVMLh2tOsZ4f5yCQ_QQTWv28m-NUJo"),
    (307, "t05", "测试05", "小组A", "employee", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMwNywiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.Gw6aEc2oZLA8tryrh3URN8h9V85TW3cWgN3z2o7wFys"),
    (308, "t06", "测试06", "小组A", "employee", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMwOCwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.lXmVQ4nSCJS_pum2hbbGe_rurE5oq0eTz4u7vgflYk0"),
    (309, "t07", "测试07", "小组A", "employee", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMwOSwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.HcEX8WPfZjT2DWWlZI_Rx5DnyfreGOAzB_X3XHCe908"),
    (310, "t08", "测试08", "小组A", "employee", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMxMCwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.UOghJm13foVf4hNhHqARiV-7L_yZ2g-pZCgFQLPU2CQ"),
    (311, "t09", "测试09", "小组B", "employee", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMxMSwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.1iiotsMuWhFCOpm6SMBJAgi2H4N0bNPA5EPWZtoJnAQ"),
    (312, "t10", "测试10", "小组B", "employee", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMxMiwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.8hqOXj6mdqWVImEvoCbZCZHilNi59VW9Fh4alUfFBKM"),
    (313, "t11", "测试11", "小组B", "employee", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMxMywiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.DLP3j-APBlgaQp_8TP4B6ksUKBt7JmnNsQQjg2C7qz0"),
    (314, "t12", "测试12", "小组B", "employee", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjMxNCwiaWF0IjoxNzgyNzM3NTIyLCJleHAiOjE3ODUzMjk1MjJ9.lkYVnXTBxRccTfwN2SNxB8kKCLgJRURZ3KKyjRqnIhc"),
]

CN_WEEKDAY = ["一", "二", "三", "四", "五", "六", "日"]

ROLE_WORK = {
    "pm": [
        "撰写需求文档 PRD；与业务方对齐优先级；评审技术方案",
        "梳理本周需求池；跟进阻塞项；协调设计资源",
        "组织需求评审会；整理 acceptance criteria；更新 roadmap",
        "对接外部依赖方；评审测试用例；规划下个迭代",
    ],
    "director": [
        "跨部门资源协调；review 小组A/B 周报；规划季度目标",
        "主持双周会；评估风险项；调整人员配置",
        "review 关键需求 ROI；与 PM 对齐产品方向",
        "审批采购申请；对接合规；梳理技术债",
    ],
    "team_leader": [
        "分配迭代任务；code review；跟进组员阻塞",
        "组织站会；评审设计稿；梳理技术方案",
        "code review 5 个 PR；处理线上告警；指导新人",
        "梳理本周进度；与 PM 对齐优先级；调整任务分配",
    ],
    "employee": [
        "实现登录接口；修复表单校验 bug；补充单元测试",
        "重构用户列表分页；修复 N+1 查询；写集成测试",
        "完成报表导出功能；修复样式问题；review 同事 PR",
        "修复 dashboard 数据统计偏差；优化 SQL 查询；写文档",
    ],
}

random.seed(42)


def make_summary(uid: int, username: str, nickname: str, team: str, role: str, day: datetime) -> str:
    date_str = day.strftime("%Y-%m-%d")
    weekday = CN_WEEKDAY[day.weekday()]
    work = random.choice(ROLE_WORK[role])
    team_label = team if team else "无小组"
    return f"[{date_str} 周{weekday} {username}-{nickname}-{team_label}] {work}"


def make_jsonl(uid: int, username: str, session_ref: str, day: datetime, summary: str) -> bytes:
    started = day.replace(hour=10, minute=0, second=0, microsecond=0)
    entries = [
        {
            "type": "user",
            "timestamp": started.isoformat(),
            "message": f"开始会话: {summary}",
        },
        {
            "type": "assistant",
            "timestamp": (started + timedelta(minutes=2)).isoformat(),
            "model": "claude-sonnet-4-6",
            "message": "理解，开始处理这个任务。",
            "tool_calls": [{"name": "Read", "args": {"file_path": "src/main.go"}}],
        },
        {
            "type": "assistant",
            "timestamp": (started + timedelta(minutes=15)).isoformat(),
            "model": "claude-sonnet-4-6",
            "message": "完成代码修改。",
            "tool_calls": [{"name": "Edit", "args": {"file_path": "src/main.go"}}],
        },
        {
            "type": "user",
            "timestamp": (started + timedelta(minutes=50)).isoformat(),
            "message": "运行测试验证一下",
        },
        {
            "type": "assistant",
            "timestamp": (started + timedelta(minutes=58)).isoformat(),
            "model": "claude-sonnet-4-6",
            "message": "测试通过，会话结束。",
        },
    ]
    lines = [json.dumps(e, ensure_ascii=False) for e in entries]
    return ("\n".join(lines) + "\n").encode("utf-8")


def make_token_usage(day: datetime, role: str):
    base = {"employee": 1.0, "team_leader": 0.8, "pm": 0.6, "director": 0.5}[role]
    rng = random.Random(int(day.strftime("%Y%m%d")))
    input_tokens = int(rng.randint(40_000, 180_000) * base)
    output_tokens = int(rng.randint(3_000, 18_000) * base)
    cache_creation = int(input_tokens * rng.uniform(0.3, 0.6))
    cache_read = int(input_tokens * rng.uniform(1.0, 2.5))
    total = input_tokens + output_tokens + cache_creation + cache_read
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_creation_tokens": cache_creation,
        "cache_read_tokens": cache_read,
        "total_tokens": total,
        "models": ["claude-sonnet-4-6"],
    }


def build_multipart(metadata_json, files):
    boundary = "----aida-seed-boundary-" + hex(random.randint(0, 1 << 32))[2:]
    crlf = b"\r\n"
    body = b""
    body += b"--" + boundary.encode() + crlf
    body += b'Content-Disposition: form-data; name="metadata"' + crlf + crlf
    body += metadata_json + crlf
    for field_name, content in files.items():
        body += b"--" + boundary.encode() + crlf
        body += (
            f'Content-Disposition: form-data; name="{field_name}"; '
            f'filename="{field_name}.jsonl"').encode() + crlf
        body += b"Content-Type: application/x-jsonlines" + crlf + crlf
        body += content + crlf
    body += b"--" + boundary.encode() + b"--" + crlf
    return body, boundary


def upload_one_user(uid: int, username: str, nickname: str, team: str, role: str, token: str):
    sessions_meta = []
    files = {}
    for day in DAYS:
        session_ref = f"seed-{username}-{day.strftime('%Y%m%d')}"
        started = day.replace(hour=10, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        ended = started + timedelta(hours=1)
        summary = make_summary(uid, username, nickname, team, role, day)
        sessions_meta.append({
            "session_ref": session_ref,
            "agent_type": "claude_code",
            "started_at": started.isoformat(),
            "ended_at": ended.isoformat(),
            "duration_secs": 3600,
            "model": "claude-sonnet-4-6",
            "summary": summary,
            "tool_calls": {"Read": 8, "Edit": 5, "Bash": 4, "Grep": 3},
            "git_commits": [f"{session_ref}-abc1234"],
            "token_usage": make_token_usage(day, role),
        })
        files[f"file_{session_ref}"] = make_jsonl(uid, username, session_ref, day, summary)

    metadata = json.dumps({"sessions": sessions_meta}, ensure_ascii=False).encode("utf-8")
    body, boundary = build_multipart(metadata, files)

    req = urlreq.Request(
        f"{API_BASE}/sessions/batch",
        data=body,
        method="POST",
    )
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    try:
        with urlreq.urlopen(req, timeout=60) as resp:
            status = resp.status
            resp_body = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  ❌ {username} ({nickname}): 请求失败 - {e}", file=sys.stderr)
        return False

    if status != 200:
        print(f"  ❌ {username} ({nickname}): HTTP {status} - {resp_body[:200]}", file=sys.stderr)
        return False

    try:
        parsed = json.loads(resp_body)
        results = parsed.get("results", [])
        created = sum(1 for r in results if r.get("status") == "created")
        updated = sum(1 for r in results if r.get("status") == "updated")
        errors = [r for r in results if r.get("status", "").startswith("error")]
        print(f"  ✅ {username} ({nickname}) [{role}/{team or '-'}]: "
              f"created={created} updated={updated} errors={len(errors)}")
        if errors:
            for e in errors:
                print(f"      - {e}", file=sys.stderr)
            return False
    except Exception:
        print(f"  ⚠️  {username}: 响应解析失败 - {resp_body[:200]}", file=sys.stderr)
    return True


def main():
    print(f"为 {len(USERS)} 个账号 × {len(DAYS)} 天 = {len(USERS) * len(DAYS)} 份 session")
    print(f"日期范围: {DAYS[0].strftime('%Y-%m-%d')} ~ {DAYS[-1].strftime('%Y-%m-%d')}")
    print()
    ok = 0
    for uid, username, nickname, team, role, token in USERS:
        if upload_one_user(uid, username, nickname, team, role, token):
            ok += 1
        time.sleep(0.2)
    print()
    print(f"完成: {ok}/{len(USERS)} 个账号上传成功")
    return 0 if ok == len(USERS) else 1


if __name__ == "__main__":
    sys.exit(main())
