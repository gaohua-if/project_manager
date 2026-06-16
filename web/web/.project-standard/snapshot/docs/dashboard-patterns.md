# Dashboard 样板规范

## 路由

- 示例路由：`/examples/dashboard` when runtime examples are kept.
- 示例目录：`src/features/dashboard-example` in the starter repository.
- 稳定参考：`references/starter-blueprints/dashboard/` 完整模式包。

## 图表技术栈

Dashboard 样板默认使用 ECharts。AntD 负责页面布局、卡片、筛选表单、加载态、空态和错误态；ECharts 只负责图表渲染、tooltip、legend、坐标轴、series、resize 和图表交互。

不默认使用 G2、Ant Design Charts 或其他复杂 React 图表 wrapper，原因是样板需要明确控制图表生命周期、resize、dispose 和 option 边界，避免 AI 生成页面时混用多套图表抽象。

## 组件边界

- `BaseEChart`：唯一直接接触 ECharts 实例的组件，负责 init、setOption、ResizeObserver resize、loading、empty、error 和 dispose，不写业务数据转换和具体 option。
- `ChartCard`：统一图表卡片标题、描述、extra、卡片 padding 和外层状态，不处理 ECharts option。
- `MetricCard`：用于顶部指标卡，展示指标值、单位、说明、趋势和右上角语义图标。图标通过组件参数传入，不进入接口数据；默认不可点击，不使用左上角装饰圆点。
- `TimeRangeFilter`：用于 Dashboard 查询条件，筛选变化后触发 Query 重新请求，并同步 URL query。

业务页面应复制或适配完整模式包中的稳定视觉层，不要只读取页面编排后重新手写简化卡片。稳定视觉层至少包括指标卡、右上角语义图标、图表容器、Grid、渐变、阴影、状态色和 loading / empty / error 状态；业务层只负责接口、字段、图标映射和图表数据映射。

## 数据流

页面使用 TanStack Query 获取数据：

1. 页面从 URL query 解析筛选条件。
2. `useDashboardOverview` 以筛选条件作为 query key。
3. `dashboardApi` 作为真实接口入口，当前转调 `dashboardMockApi`。
4. 页面只消费 hook 返回的数据，不直接拼接请求，也不写 mock 数据。
5. 图表组件根据传入数据生成各自 option。

新增 Dashboard 图表时，应把图表组件放在 `charts/` 目录，把 mock 数据和接口类型放在 `api/` 目录，把页面编排放在 `pages/` 目录。不要把图表 option 散落到页面组件中。

## PRD 业务报表生成

- PRD 驱动的新业务应用中，统计页、报表页、Dashboard 的查询条件默认来自 URL query，除非 PRD 明确要求内部状态。
- 表格型报表优先复用列表页结构：`PagePanel`、`TableLayout.SearchGroup`、`ResourceTable`、统一 loading/empty/error。
- 图表型 Dashboard 优先复用本规范组件边界：筛选组件、`MetricCard`、`ChartCard`、独立 chart 组件。
- 用户提供视觉稿时，默认将其视为视觉契约，保留信息层级、密度、强调色和卡片处理；只有用户明确说明是概念参考时才允许明显偏离。
- 不要用页面级 `Card + Space + inline style` 搭查询区或整体报表页面。
- 导出、刷新等页面级按钮应放在 Content PageHeader，并遵守 `docs/anti-patterns.md` 中的 CSV escape 规则。

## 布局策略

Dashboard 只面向后台桌面和笔记本屏幕，不按移动端设计。内容区 `min-width: 1080px`，`max-width: 1800px`，宽屏居中，窄屏占满可用宽度，极窄窗口允许横向滚动。

指标区使用 CSS Grid 自动适配，每张指标卡最小宽度 220px。图表区使用 12 列 Grid：宽屏下趋势图 8 列、环图 4 列、TopN 和资源使用各 6 列；笔记本窄屏下根据断点收敛到 12 列，避免拥挤和重叠。图表高度固定在 340px 左右，不使用不确定父容器高度。
