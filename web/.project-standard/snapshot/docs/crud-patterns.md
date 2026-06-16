# CRUD Patterns

AIHub Starter 提供两套 CRUD 样板，AI coding 生成业务页面时应优先按场景选择现有样板，不重新发明列表、表单、错误和返回策略。

This is a documentation contract, not a runtime route. Do not create or keep a dedicated CRUD rules page in generated business projects. Use `references/starter-blueprints` as the stable agent reference; executable runtime examples are available only when examples are kept.

## Current Form Template Contract

Table CRUD owns the reusable create/edit form templates. Generated table-first resources should select one of these shapes instead of inventing a new form shell. The starter runtime example may expose several variants for demonstration; real business list pages should normally expose one create entry that matches the chosen workflow, not a user-facing template picker.

- `simple`: quick-create form with a small core field set and safe hidden defaults.
- `standard`: default flat form for ordinary create/edit pages.
- `steps`: wizard form for step-by-step workflows. Keep every step component mounted and toggle `hidden` / `aria-hidden`; do not unmount step content, because next/back must preserve AntD Form values, upload state, and dynamic `Form.List` rows. There is no standalone confirmation page by default; the last step's next button becomes the submit button.
- `advanced`: large multi-section form with section navigation and a sticky submit area.

All four variants use the same form state owner: AntD Form. Do not mirror field values in Zustand or page-local state except transient UI state such as the active step. The form grid is container-responsive: when the form card/content width is too narrow, every variant must fall back to one form item per row.

## Table CRUD

适用于资源、任务、配额、用户等结构化列表。

- 列表状态以 URL query 为唯一来源。
- 搜索、筛选、分页、排序都写回 query。
- 新建、编辑必须使用独立路由页面。
- create 成功后回列表第一页。
- edit/detail/back 返回时保留原 query。
- 字段错误使用 `getApiFieldErrors` 回填到对应 `Form.Item`。

参考页面：`/examples/table-crud` when runtime examples are kept.
稳定参考：`references/starter-blueprints/table-crud`

列表页必须同时使用 `list-page.tsx` 与 `list-pattern.css`。`TableLayout` 提供中性的共享默认值，`list-pattern.css` 提供主业务列表的页面级工具栏、控件、表格间距和响应式视觉规范；不要只复制 JSX 或只依据共享组件默认样式。

## Tag 侧栏 + 模块列表 CRUD

适用于模块、模板、插件、镜像等分类浏览场景。

- 侧栏分类 count 来自 facet/category API，不使用当前页列表 total 代替。
- 排序按钮使用 `ModuleOrderBar` 并写回 URL query。
- 列表卡片用于展示描述、统计、标签和常用操作。
- 详情页应包含基础信息、运行配置、参数信息、日志或异步子资源。

参考页面：`/examples/module-crud` when runtime examples are kept.
稳定参考：`references/starter-blueprints/module-crud`

## 表单规则

- 字段较多、包含双栏布局、key-value/Form.List、上传、跨字段校验时，必须使用新页面新路由，不能用弹窗。
- 普通资源默认使用 Table CRUD 平铺表单：宽容器双列，窄容器自动单列。
- 标签、上传、描述等需要空间的字段独占整行。
- 不为线性填写流程强制增加分组卡片。
- 仅当左右职责稳定，且存在独立参数组、资源或存储配置时，使用 Module CRUD 的左右分区复杂表单。
- 编辑页首次加载使用 `PageSkeleton`，不要使用整页转圈 loading。
- 提交中使用局部 `Spin` 或按钮 loading。
- 未保存离开确认使用 `useFormLeaveConfirm`。

## 数据流规则

- TanStack Query 查询不做额外页面级缓存。
- mutation 成功后 invalidate 对应 list/detail/facet query。
- 4xx 不自动重试，服务异常最多重试两次。
- 真实 API 字段错误统一在 request/error adapter 层转换。
- 空态、错误、loading、删除后页码回退必须作为 CRUD 样板的一部分实现。
