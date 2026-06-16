# AIHub Starter Anti-patterns

Use this document before generating or reviewing business pages. Each item describes a concrete failure mode, why it is wrong, the expected pattern, and how an agent should self-check.

## 1. 裸用 AntD Table

错误表现：

- 页面直接 `import { Table } from "antd"` 并把列表、分页、loading 都写在页面里。
- 表格空态、统一样式和操作列规则各页面不一致。

为什么错：

- starter 已提供 `ResourceTable`，它承载表格默认尺寸和空态，并明确不生成 Table 内滚动逻辑。
- 低模型容易在裸 Table 上继续散写列宽、空态和 action 样式。

正确做法：

- 使用 `ResourceTable<T>`。
- 行操作使用 `ResourceActions`。

简短示例：

错误：`<Table columns={columns} dataSource={rows} />`

正确：`<ResourceTable rowKey="id" columns={columns} dataSource={rows} />`

Agent 自检：

- 主列表页是否导入了 AntD `Table`？如果是，除非是组件样板页，否则应改为 `ResourceTable`。

## 2. 手写 Space 或 div toolbar

错误表现：

- 用 `<Space>`、`<div className="toolbar">`、内联 style 拼接搜索、筛选、按钮。
- 页面局部 CSS 强行设置 input/select/button 高度。

为什么错：

- `TableLayout` 已统一 toolbar 间距、控件宽度、36px 高度和响应式行为。
- 手写 toolbar 容易导致 Input、Search、Select、DatePicker 高度不一致。

正确做法：

- 用 `TableLayout` 的 `operations` 和 `search`。
- 搜索和筛选放进 `TableLayout.SearchGroup`。
- 优先使用 `TableLayout.SearchInput`、`TableLayout.SelectFilter`、`TableLayout.DateRangeFilter`。

Agent 自检：

- 是否存在 `Space` 包住筛选控件？
- 是否存在 page-local CSS 修改 `.ant-input`、`.ant-select-selector` 高度？
- 报表页是否用 `Card + Space + inline style` 拼查询区？如果项目已有 `TableLayout` 或等价筛选区，应改为统一模式。

## 3. 不使用 PagePanel

错误表现：

- 页面返回 fragment：`<> <Nav /> <div>...</div> </>`。
- 每个页面自己写标题、返回、actions、margin。

为什么错：

- `PagePanel` 是页面根 DOM shell，并把 breadcrumb 配置注册到 TopHeader。
- 散装结构会导致 Header Nav、返回拦截、Content 间距和操作区不一致。

正确做法：

- 列表、表单、详情、Dashboard 都以 `PagePanel` 作为根容器。
- TopHeader 只显示轻量 breadcrumb，不显示页面 H1、描述或业务操作。
- 一级列表和 Dashboard 的标题、描述及页面级操作放在 Content PageHeader。
- 二级详情页如果已有实体 Hero Card，应关闭 Content PageHeader，避免重复实体大标题。

Agent 自检：

- 业务页面根 JSX 是否是 `PagePanel` 或当前项目明确等价容器？
- 页面 H1 是否只出现在 Content PageHeader 或实体 Hero Card？
- 是否把 `references/` 文件注册进 runtime route？如果是，必须删除。

## 4. Header 乱加 sidebar collapse、搜索或 demo 控件

错误表现：

- 在 Header 里新增第二个 sidebar collapse 按钮。
- 为单个业务模块在 Header 加搜索框、筛选器、demo 开关。
- 在 TopHeader 中显示页面 H1、描述或业务操作。

为什么错：

- Sidebar 折叠由 `Sidebar` 拥有。
- Header 是紧凑的全局 breadcrumb shell，业务标题、筛选和操作属于页面 Content。

正确做法：

- collapse 留在 `Sidebar`。
- 页面搜索和筛选放在 `TableLayout.SearchGroup`。
- breadcrumb 只在 TopHeader 显示，不在 Content 重复渲染。

Agent 自检：

- Header diff 是否包含业务模块专属逻辑？
- 是否新增了和 Sidebar 重复的折叠按钮？

## 5. 行操作全部 inline

错误表现：

- 操作列展示 `详情 编辑 复制 分享 启用 禁用 删除` 等所有按钮。
- 操作列变宽或挤压业务列。

为什么错：

- 表格行操作需要可扫描。
- 低频、危险、扩展动作应收进 `更多`。

正确做法：

- 使用 `ResourceActions`。
- 默认最多 2 个高频动作 inline。
- 其余动作进入 `更多`。
- 每个动作都配置匹配 icon。

Agent 自检：

- 单行 inline 操作是否超过 2 个？
- 删除、重置、禁用是否在更多中也有 icon 和确认？
- 主名称列如果是详情链接，是否只是文字链接？详情、编辑、删除等图标应只出现在操作区。

## 6. 危险操作没有确认弹窗

错误表现：

- 删除、下架、禁用、重置直接调用 API。
- 只用浏览器 `confirm` 或没有风险说明。

为什么错：

- 企业后台高风险操作必须有一致的二次确认和危险语义。

正确做法：

- 使用 `confirmDangerAction` 或项目已有危险操作确认封装。
- 弹窗文案明确对象名称和不可逆风险。

Agent 自检：

- 搜索 `delete`、`disable`、`reset`、`remove` 的 onClick，是否直接调用 mutation？

## 7. 服务端列表数据放进 Zustand

错误表现：

- 列表 rows、详情 data、分页结果写入 Zustand store。
- 页面一边用 Query，一边用 Zustand 复制服务端数据。

为什么错：

- 服务端状态应由 TanStack Query 管理。
- Zustand 只用于轻量 UI 状态，例如 sidebar collapsed。

正确做法：

- 列表、详情、枚举、dashboard 数据使用 `useQuery`。
- 写操作用 `useMutation`，成功后 invalidate query。

Agent 自检：

- store 文件中是否出现 `rows`、`list`、`detail`、`pageData` 等服务端数据？

## 8. 筛选、分页、排序状态来源混乱

错误表现：

- keyword 在 local state，status 在 URL，page_num 在 table 内部，sorter 又在另一个 state。

为什么错：

- 返回列表、刷新、分享 URL、登录跳回都会丢状态。

正确做法：

- 列表 query model 统一来自 URL search params。
- `updateQuery` 只维护页面 query model。

Agent 自检：

- 列表页是否存在多个 `useState` 管筛选、分页、排序？
- URL 是否完整表达当前列表状态？
- 新 starter 业务应用中的统计页日期范围、部门级别、报表筛选是否也进入 URL search params？除非 PRD 明确要求内部状态，否则不应只放 local state。

## 9. API 参数映射散落在页面组件里

错误表现：

- JSX 或 table change handler 中到处写 `page: page_num`、`pageSize: page_size`、`search: keyword`。
- 多个组件重复处理后端字段名。

为什么错：

- 后端参数命名会污染 UI 层。
- 接口变更会导致多个页面散点修改。

正确做法：

- 页面使用统一 UI query model：`page_num`、`page_size`、`keyword`、`status`、`order_by`。
- model API 或 query adapter 集中转换后端参数。
- response adapter 集中转换分页响应。

Agent 自检：

- 页面 JSX 中是否出现后端字段名 `page`、`pageSize`、`search`、`state`？
- 是否存在独立 `model-api.ts` 或 adapter 函数？

## 10. 写死分页数组字段

错误表现：

- 真实接口返回 `data.list`，生成代码读取 `data.items`。
- 某个接口返回 `records` 或空对象时，页面直接崩溃或显示错误数据。
- 下拉选项读取 `allModelsQuery.data?.data?.items`，导致选项为空。

为什么错：

- `code/msg/data` 外层结构稳定，但 `data` 内部字段会因后端接口而不同。
- 页面层不应该知道后端分页数组字段名。

正确做法：

- 列表接口在 model API 层使用 `normalizePageResult(response.data, query)`。
- endpoint 明确有特殊字段时，也在 adapter 层处理，不把 `items/list` 泄漏到 JSX。
- 缺失或异常列表数据应降级成空数组，交给 `ResourceTable` 空态展示。

Agent 自检：

- 搜索 `.items`、`.list`、`.records`，确认它们没有出现在页面 JSX 中。
- 搜索 `normalizePageResult`，确认每个分页列表接口都有统一适配。

## 10.1 业务 code 被统一错误处理吞掉

错误表现：

- PRD 规定 `code=1` / `code=2` 是业务状态，但全局 request 在 `code !== 0` 时直接 throw。
- endpoint adapter 返回 `response.data`，页面再判断 `response.code`。
- 页面 catch 里把所有非 0 code 都显示成“查询失败”。

为什么错：

- 全局 request 适合处理网络、超时、401、403 和明确的全局错误。
- endpoint-specific business code 应由 endpoint adapter 解释，页面展示业务状态。

正确做法：

- 为这类 endpoint 使用 raw request helper 或跳过通用 business-code throw。
- adapter 保留 raw `code/msg/data`，并返回 `success` / `unsupported` / `unlimited` / `failed` 等页面友好状态。
- 页面只渲染 adapter 输出的状态。

Agent 自检：

- 搜索 PRD 中的非 0 code，确认每个 code 在 adapter 中有显式分支。
- 搜索 `api.get` / `api.post`，确认业务状态接口没有被默认 request helper 提前 throw。
- 页面是否还在 `catch` 里把所有业务状态归为“失败”？

## 10.2 CSV 直接 join

错误表现：

- 导出代码使用 `row.join(",")`。
- 部门数组先 `join(", ")`，再作为 CSV 单元格直接拼接。
- 字段中包含逗号、换行或双引号时，Excel 列错位。

为什么错：

- CSV 单元格需要转义逗号、引号、换行和空值。
- 业务报表导出通常会包含中文、部门路径、模型名或备注，不能假设字段安全。

正确做法：

- 使用 `escapeCsvCell(value)`。
- 用 `row.map(escapeCsvCell).join(",")` 生成每行。
- 保持 PRD 表头顺序和字段顺序。

Agent 自检：

- 搜索 `.join(",")`，确认 CSV 行不是直接由原始 row join 得到。
- 确认导出字段中的数组、空值、引号、换行都有稳定输出。

## 10.3 报表页局部 state 和 Card 拼装

错误表现：

- 统计页用 `useState` 保存日期范围、关键词、部门、排序等查询条件。
- 查询条件放在 `<Card><Space ... style={{ ... }}>` 里手工排版。
- 报表表格、导出按钮、刷新按钮各自散落在页面 JSX 中。

为什么错：

- 新 starter 业务应用要求列表和报表查询状态可刷新、可分享、可回退。
- `Card + Space + inline style` 会绕过 `TableLayout` 或 dashboard blueprint 的间距、响应式、loading/empty/error 约束。

正确做法：

- 报表查询模型来自 URL search params。
- 表格型报表使用 `PagePanel` + `TableLayout.SearchGroup` + `ResourceTable`。
- 图表型 Dashboard 使用 `docs/dashboard-patterns.md` 或 dashboard blueprint 中的 filter、metric、chart 组件。
- 只有 modal 开关、当前编辑对象、表单实例等瞬态 UI 状态可以留在 local state。

Agent 自检：

- 搜索报表页 `useState(`，确认没有查询条件源自 local state，除非 PRD 明确要求并已记录例外。
- 搜索报表页 `Card`、`Space`、`style={{`，确认不是用它们拼页面查询区。
- 确认日期范围、筛选条件和分页变化都会更新 URL search params。

## 10.4 无依据的 PRD exception

错误表现：

- 代码里写 `PRD exception`，但 PRD、实施计划和最终报告都没有对应条目。
- 明明是接口查询条件，却用一句 exception 注释继续放在 local state。

为什么错：

- exception 是验收证据，不是绕过 checklist 的开关。
- 新业务应用生成必须能追溯每个偏离规则的原因。

正确做法：

- 查询相关状态默认进入 URL search params。
- 只有 PRD 明确说明 transient/client-only，或 API 合同明确说明前端本地过滤，才允许查询状态留在 local state。
- 例外必须写进 `docs/prd-implementation-plan.md` 或等价实施计划，并在最终报告列出。

Agent 自检：

- 搜索 `PRD exception`，逐个确认是否能在 PRD 实施计划中找到对应证据。
- 找不到证据时，删除 exception 并按标准规则修复；如果合同不清楚，列为 failed/needs-confirmation。

## 10.5 嵌套路由父级没有 Outlet

错误表现：

- 路由对象有 `children`，但父级 `element` 是普通页面组件，没有渲染 `Outlet`。
- 菜单可以点到子页面 URL，但 React Router 只渲染父页面，子页面不可见。

为什么错：

- 在 React Router 中，子路由必须由父级 `Outlet` 承载。
- PRD 页面对路由表“存在”不等于用户能访问。

正确做法：

- 不需要父级页面时，使用扁平路由，例如 `/usage-stats/users` 和 `/usage-stats/departments`。
- 需要父级布局时，父级 element 必须是 layout/shell，并渲染 `Outlet`。
- 菜单分组路径应指向默认子页 redirect、真实页面或可渲染布局。

Agent 自检：

- 搜索 `children:`，确认每个父路由 element 都渲染 `Outlet`，或确认该路由已扁平化。
- 手动核对每个 PRD 页面 URL 是否能渲染对应页面，而不是只存在于 route config。

## 11. 直接展示 raw ISO 日期

错误表现：

- 表格或详情页直接展示 `2026-05-29T14:52:27.179+08:00`。
- 时间列因为 ISO 字符串太长被挤成两行。
- 同一项目里有的页面用浏览器 locale，有的页面用后端原始字符串。

为什么错：

- 企业后台需要稳定、可扫描的时间格式。
- raw ISO 字符串会增加列宽压力并破坏列布局。
- 浏览器 locale 输出在不同机器上可能不一致。

正确做法：

- 使用 `formatDateTime(value)`。
- 时间列通常展示为 `YYYY-MM-DD HH:mm:ss`。
- 日期字段只需要日期时使用 `formatDate(value)`。

简短示例：

错误：`{ title: "更新时间", dataIndex: "updated_at", width: 180 }`

正确：`{ title: "更新时间", dataIndex: "updated_at", width: 180, render: formatDateTime }`

Agent 自检：

- 搜索 `created_at`、`updated_at`、`createdAt`、`updatedAt`，确认所有用户可见位置都有格式化。
- 搜索 `toLocaleString()`，除非产品明确要求本地格式，否则应替换为项目格式化工具。

## 12. Table 内滚动

错误表现：

- 表格为空时仍然出现横向滚动条。
- 每个列表页都复制 `scroll={{ x: 960 }}` 或 action 列默认 `fixed: "right"`。
- 时间列、操作列过宽，挤压主要业务列。

为什么错：

- 横向滚动会降低后台列表扫描效率。
- 空数据也出现滚动条会造成明显的错误状态。
- `scroll.x`、`scroll.y` 和固定列会掩盖列设计及页面布局问题。

正确做法：

- 使用 `<ResourceTable ... />`，不传 `scroll`、`horizontalScroll` 或固定列配置。
- 通过字段取舍、时间格式化、`ellipsis`、减少 inline 操作和响应式列设计控制宽度。
- 产品确实需要 Table 内滚动时，由项目用户在生成后自行定制，不属于 starter 或 Skill 默认能力。

简短示例：

错误：`<ResourceTable scroll={{ x: 960 }} columns={columns} />`

正确：`<ResourceTable columns={columns} />`

Agent 自检：

- 搜索 Table 范围内的 `scroll`、`horizontalScroll`、`fixed: "right"`，必须为零。
- 分别检查空表和有数据表，均不应出现 Table 内滚动条。

## 13. 普通标签全部灰色

错误表现：

- 所有 `<Tag>` 都被全局 CSS 改成灰色胶囊。
- 业务标签、分类标签、环境标签和状态标签看起来没有层级。

为什么错：

- AntD 自带 preset color 能让业务标签更容易扫描。
- 状态语义已经由 `StatusTag` 承担，普通标签不应该再被压成状态样式。

正确做法：

- 普通业务标签使用 AntD `Tag color="blue"`、`color="cyan"` 等预设色。
- 动态标签使用 `getTagColor(tag, index)`。
- 状态字段使用 `StatusTag`。

Agent 自检：

- 搜索全局 CSS，确认没有 `.ant-tag:not(.status-tag)` 这类覆盖所有普通标签的规则。
- 标签列表是否显式设置 `color` 或使用 `getTagColor`？

## 14. 假 Dashboard 和 demo 大色块

错误表现：

- Dashboard 只有大色块、随机数字、无业务含义图表。
- 为了视觉效果堆多个图，但没有 loading、empty、error。

为什么错：

- Dashboard 应表达真实业务指标、趋势、异常和资源状态。
- 无意义图表会误导用户，也让后续接 API 更困难。

正确做法：

- 指标卡必须有清晰标题、数值、单位、辅助说明。
- 图表必须有 loading、empty、error 和 resize 行为。
- 每个图都能说明业务问题。

Agent 自检：

- 每个指标是否能映射到真实 API 字段？
- 图表为空或加载失败时是否有状态？
- 是否为了填满页面而添加无意义图表？
