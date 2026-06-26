-- Demo report seed: 3 business days (2026-06-24/25/26) of realistic daily reports
-- across the full personal -> team -> department chain, plus the current week's
-- team & department weekly reports (week_start 2026-06-22).
--
-- Re-runnable: deterministic UUIDs via md5(seed)::uuid, wrapped in a transaction
-- that first clears the target dates/week to keep cross-table source links consistent.
--
-- Usage:
--   docker compose exec -T db psql -U aidashboard -d aidashboard < scripts/seed_reports_demo.sql

BEGIN;

-- ── Clear target ranges so re-runs stay clean and source links stay consistent ──
DELETE FROM department_weekly_reports WHERE week_start = DATE '2026-06-22';
DELETE FROM team_weekly_reports       WHERE week_start = DATE '2026-06-22';
DELETE FROM department_reports        WHERE report_date IN (DATE '2026-06-24', DATE '2026-06-25', DATE '2026-06-26');
DELETE FROM team_reports              WHERE report_date IN (DATE '2026-06-24', DATE '2026-06-25', DATE '2026-06-26');
DELETE FROM daily_reports             WHERE report_date IN (DATE '2026-06-24', DATE '2026-06-25', DATE '2026-06-26');

-- ── Per (team, day) work focus used to compose realistic content ──
CREATE TEMP TABLE _focus (
  team_id  UUID,
  idx      INT,
  done1    TEXT,
  done2    TEXT,
  doing    TEXT,
  risk     TEXT,
  plan     TEXT
) ON COMMIT DROP;

INSERT INTO _focus (team_id, idx, done1, done2, doing, risk, plan) VALUES
-- AI工程（平台后端）
('a0000000-0000-0000-0000-000000000001', 1,
 '完成需求看板后端分页与多条件筛选接口，覆盖按负责人/优先级/截止日期的组合查询',
 '联调会话采集上报链路，修复 token 聚合在空模型字段下的空指针',
 '梳理 /dashboard/risks 的越权过滤逻辑，准备补充团队维度单测',
 'MinIO 原始日志上传偶发超时，已加重试但仍需观察网关侧限流',
 '把分页接口接入前端看板，补充权限过滤的边界用例'),
('a0000000-0000-0000-0000-000000000001', 2,
 '实现日报生成草稿接口 /reports/today/draft，串通 consumer 的 claude -p 调用',
 '优化需求列表 SQL，N+1 查询合并为单次 join，列表 P95 从 480ms 降到 120ms',
 '部门日报来源追踪（source_team_report_ids）落库与回填脚本',
 'consumer 容器复用服务端 Claude 登录态，偶发 401 需排查 token 过期窗口',
 '完成来源追踪回填并联调部门日报详情页的“原始小组日报”标签'),
('a0000000-0000-0000-0000-000000000001', 3,
 '接入部门日报来源追踪，详情页可逐组查看原文，覆盖已发送/未发送状态',
 '联调前端报表导出，补充导出按钮的加载与错误态',
 '压测报表导出在 5k 会话量下的内存占用，定位一处切片预分配问题',
 '导出大数据量时前端有约 1.5s 卡顿，待评估分页导出方案',
 '提交导出内存优化 PR，整理本周联调遗留问题清单'),
-- 推理加速
('a0000000-0000-0000-0000-000000000002', 1,
 '完成 vLLM 0.6 升级与回归，主推理服务启动正常',
 '采集 KV cache 命中率基线，整理高并发下的 block 复用数据',
 '分析长上下文场景下的 KV cache 驱逐策略',
 'A100 测试机偶发 ECC 报错，已报修，可能影响压测排期',
 '产出 KV cache 命中率优化方案，准备灰度参数'),
('a0000000-0000-0000-0000-000000000002', 2,
 '完成 INT8 量化精度回归，核心评测集掉点控制在 0.4% 以内',
 '构建 TensorRT-LLM 引擎并跑通 batch=32 的吞吐基准',
 '对比 AWQ 与 SmoothQuant 在 7B 模型上的精度/速度权衡',
 'TensorRT 引擎构建耗时较长（约 25min），CI 集成需异步化',
 '输出量化方案选型结论，准备小流量上线验证'),
('a0000000-0000-0000-0000-000000000002', 3,
 '完成连续批处理（continuous batching）吞吐调优，QPS 提升约 38%',
 '优化显存碎片，降低 OOM 触发率',
 '评估投机解码（speculative decoding）在中文长文本下的收益',
 '投机解码在短回复场景收益有限，需按场景分流',
 '整理本周性能数据，准备给 PM 的推理成本汇报'),
-- 模型训练
('a0000000-0000-0000-0000-000000000003', 1,
 '完成训练语料清洗与去重 pipeline，去重后语料约 1200 万条',
 '抽检标注质量，定位一批标签噪声并回退重标',
 '设计 SFT 数据配比实验（通用/代码/工具调用）',
 '部分外采数据版权标注缺失，需法务确认后方可纳入训练',
 '冻结清洗后数据集 v3，启动首轮 SFT 基线训练'),
('a0000000-0000-0000-0000-000000000003', 2,
 '完成 LoRA SFT 首轮训练，loss 收敛正常',
 '执行学习率扫描（1e-4 ~ 5e-5），定位较优区间',
 '搭建自动评测流水线，接入 MT-Bench 与内部业务集',
 '8 卡训练偶发 NCCL 超时，疑似网络抖动，已加超时重试',
 '基于较优学习率启动正式 SFT，补齐评测看板'),
('a0000000-0000-0000-0000-000000000003', 3,
 '完成内部评测集构建（覆盖需求拆解/日报生成等业务场景）',
 '验证分布式训练 checkpoint 断点恢复，恢复后 loss 对齐',
 '分析评测结果，定位工具调用场景的格式遵循问题',
 '工具调用格式遵循率偏低（约 86%），需补充对应训练样本',
 '补充工具调用样本并安排下一轮微调，输出周度训练小结');

-- ── Day index mapping ──
CREATE TEMP TABLE _days (d DATE, idx INT) ON COMMIT DROP;
INSERT INTO _days (d, idx) VALUES
  (DATE '2026-06-24', 1),
  (DATE '2026-06-25', 2),
  (DATE '2026-06-26', 3);

-- ── 1) Personal daily reports (employees) ──
INSERT INTO daily_reports (id, user_id, report_date, content, edited, status, submitted_to, session_ids, saved_at, submitted_at)
SELECT
  md5('dr:' || u.id::text || ':' || dy.d::text)::uuid,
  u.id,
  dy.d,
  format(
E'# %1$s · %2$s 工作日报\n\n'
'## 今日完成\n- %3$s\n- %4$s\n\n'
'## 进行中\n- %5$s\n\n'
'## 风险与阻塞\n- %6$s\n\n'
'## 明日计划\n- %7$s\n\n'
'> 本日 Claude Code 会话 %8$s 次，累计 token 约 %9$sk。',
    u.name, to_char(dy.d, 'YYYY-MM-DD'),
    f.done1, f.done2, f.doing, f.risk, f.plan,
    3 + (('x' || substr(md5(u.id::text || dy.d::text), 1, 2))::bit(8)::int % 6),
    20 + (('x' || substr(md5(u.id::text || dy.d::text), 3, 3))::bit(12)::int % 80)
  ),
  TRUE,
  'submitted',
  'team_leader',
  '{}',
  (dy.d + TIME '19:20')::timestamptz,
  (dy.d + TIME '19:40')::timestamptz
FROM users u
JOIN _days dy ON TRUE
JOIN _focus f ON f.team_id = u.team_id AND f.idx = dy.idx
WHERE u.role = 'employee';

-- ── 2) Team daily reports (one per team per day, rolling up member reports) ──
INSERT INTO team_reports (id, team_id, leader_id, report_date, content, member_report_ids, source_daily_report_ids, status, submitted_to, saved_at, submitted_at)
SELECT
  md5('tr:' || t.id::text || ':' || dy.d::text)::uuid,
  t.id,
  ldr.id,
  dy.d,
  format(
E'# %1$s 小组日报 · %2$s\n\n'
'## 整体进展\n本日 %3$s 名成员提交日报，%4$s。\n\n'
'## 关键成果\n- %5$s\n- %6$s\n\n'
'## 风险与需要协调\n- %7$s\n\n'
'## 明日重点\n- %8$s',
    t.name, to_char(dy.d, 'YYYY-MM-DD'),
    (SELECT count(*) FROM users mu WHERE mu.team_id = t.id AND mu.role = 'employee'),
    CASE t.id
      WHEN 'a0000000-0000-0000-0000-000000000001' THEN '平台后端各模块按计划推进，联调顺畅'
      WHEN 'a0000000-0000-0000-0000-000000000002' THEN '推理性能指标稳步提升，无线上事故'
      ELSE '训练与评测流水线运转正常，数据质量可控'
    END,
    f.done1, f.done2, f.risk, f.plan
  ),
  (SELECT COALESCE(array_agg(dr.id), '{}') FROM daily_reports dr JOIN users du ON du.id = dr.user_id WHERE du.team_id = t.id AND dr.report_date = dy.d),
  (SELECT COALESCE(array_agg(dr.id), '{}') FROM daily_reports dr JOIN users du ON du.id = dr.user_id WHERE du.team_id = t.id AND dr.report_date = dy.d),
  'submitted',
  'director',
  (dy.d + TIME '20:10')::timestamptz,
  (dy.d + TIME '20:30')::timestamptz
FROM teams t
JOIN _days dy ON TRUE
JOIN _focus f ON f.team_id = t.id AND f.idx = dy.idx
JOIN users ldr ON ldr.team_id = t.id AND ldr.role = 'team_leader';

-- ── 3) Department daily reports (one per day, rolling up team reports) ──
INSERT INTO department_reports (id, report_date, content, source_team_report_ids, status, saved_at, archived_at)
SELECT
  md5('dpr:' || dy.d::text)::uuid,
  dy.d,
  format(
E'# 部门日报 · %1$s\n\n'
'## 总览\n本日 %2$s 个小组完成日报汇总，整体进度符合预期。\n\n'
'## AI工程\n- 平台后端：需求看板、日报生成与来源追踪持续完善，接口性能优化成效明显。\n\n'
'## 推理加速\n- 推理性能：vLLM 升级、量化与连续批处理调优推进，吞吐与成本指标向好。\n\n'
'## 模型训练\n- 训练评测：数据清洗、SFT 与评测流水线落地，重点跟进工具调用格式遵循问题。\n\n'
'## 部门级风险\n- 测试机硬件与外采数据合规为本周主要外部依赖，已分别报修/送审。',
    to_char(dy.d, 'YYYY-MM-DD'),
    (SELECT count(*) FROM team_reports tr WHERE tr.report_date = dy.d)
  ),
  (SELECT COALESCE(array_agg(tr.id), '{}') FROM team_reports tr WHERE tr.report_date = dy.d),
  'saved',
  (dy.d + TIME '21:00')::timestamptz,
  (dy.d + TIME '21:00')::timestamptz
FROM _days dy;

-- ── 4) Team weekly reports (week_start 2026-06-22) ──
INSERT INTO team_weekly_reports (id, team_id, leader_id, week_start, content, source_daily_report_ids, source_team_report_ids, submitted_at)
SELECT
  md5('twr:' || t.id::text || ':2026-06-22')::uuid,
  t.id,
  ldr.id,
  DATE '2026-06-22',
  format(
E'# %1$s 小组周报 · 2026-06-22 ~ 2026-06-28\n\n'
'## 本周目标完成情况\n%2$s\n\n'
'## 主要成果\n- %3$s\n- %4$s\n\n'
'## 数据指标\n- 成员日报提交：%5$s 篇\n- 小组日报：%6$s 篇\n\n'
'## 下周计划\n- %7$s\n\n'
'## 风险\n- %8$s',
    t.name,
    CASE t.id
      WHEN 'a0000000-0000-0000-0000-000000000001' THEN '需求看板、日报生成与来源追踪三条主线均按计划交付，整体达成度约 90%%。'
      WHEN 'a0000000-0000-0000-0000-000000000002' THEN '推理性能优化目标超额完成，吞吐提升与成本下降均达预期。'
      ELSE '数据清洗、SFT 与评测体系搭建完成，训练基线已建立。'
    END,
    f1.done1, f3.done1,
    (SELECT count(*) FROM daily_reports dr JOIN users du ON du.id = dr.user_id WHERE du.team_id = t.id AND dr.report_date BETWEEN DATE '2026-06-22' AND DATE '2026-06-28'),
    (SELECT count(*) FROM team_reports tr WHERE tr.team_id = t.id AND tr.report_date BETWEEN DATE '2026-06-22' AND DATE '2026-06-28'),
    f3.plan, f3.risk
  ),
  (SELECT COALESCE(array_agg(dr.id), '{}') FROM daily_reports dr JOIN users du ON du.id = dr.user_id WHERE du.team_id = t.id AND dr.report_date BETWEEN DATE '2026-06-22' AND DATE '2026-06-28'),
  (SELECT COALESCE(array_agg(tr.id), '{}') FROM team_reports tr WHERE tr.team_id = t.id AND tr.report_date BETWEEN DATE '2026-06-22' AND DATE '2026-06-28'),
  (DATE '2026-06-26' + TIME '20:50')::timestamptz
FROM teams t
JOIN users ldr ON ldr.team_id = t.id AND ldr.role = 'team_leader'
JOIN _focus f1 ON f1.team_id = t.id AND f1.idx = 1
JOIN _focus f3 ON f3.team_id = t.id AND f3.idx = 3;

-- ── 5) Department weekly report (week_start 2026-06-22) ──
INSERT INTO department_weekly_reports (id, week_start, content, source_team_weekly_report_ids, archived_at)
SELECT
  md5('dpwr:2026-06-22')::uuid,
  DATE '2026-06-22',
  format(
E'# 部门周报 · 2026-06-22 ~ 2026-06-28\n\n'
'## 总览\n本周 %1$s 个小组完成周报汇总，部门各方向整体进展健康。\n\n'
'## AI工程\n平台后端围绕需求管理与报表能力持续迭代，接口性能与可观测性显著改善。\n\n'
'## 推理加速\n通过 vLLM 升级、量化与连续批处理优化，推理吞吐提升约 38%%，单位成本下降。\n\n'
'## 模型训练\n完成数据清洗与首轮 SFT，建立评测体系，下一步聚焦工具调用能力提升。\n\n'
'## 部门级风险与决策项\n- 推理测试机硬件稳定性需持续跟进；\n- 外采训练数据合规待法务确认；\n- 下周需对齐推理成本目标与训练资源排期。',
    (SELECT count(*) FROM team_weekly_reports twr WHERE twr.week_start = DATE '2026-06-22')
  ),
  (SELECT COALESCE(array_agg(twr.id), '{}') FROM team_weekly_reports twr WHERE twr.week_start = DATE '2026-06-22'),
  (DATE '2026-06-26' + TIME '21:30')::timestamptz;

COMMIT;

-- ── Summary ──
SELECT 'daily_reports' AS table, report_date::text AS bucket, count(*) FROM daily_reports WHERE report_date BETWEEN DATE '2026-06-24' AND DATE '2026-06-26' GROUP BY report_date
UNION ALL
SELECT 'team_reports', report_date::text, count(*) FROM team_reports WHERE report_date BETWEEN DATE '2026-06-24' AND DATE '2026-06-26' GROUP BY report_date
UNION ALL
SELECT 'department_reports', report_date::text, count(*) FROM department_reports WHERE report_date BETWEEN DATE '2026-06-24' AND DATE '2026-06-26' GROUP BY report_date
UNION ALL
SELECT 'team_weekly_reports', week_start::text, count(*) FROM team_weekly_reports WHERE week_start = DATE '2026-06-22' GROUP BY week_start
UNION ALL
SELECT 'department_weekly_reports', week_start::text, count(*) FROM department_weekly_reports WHERE week_start = DATE '2026-06-22' GROUP BY week_start
ORDER BY 1, 2;
