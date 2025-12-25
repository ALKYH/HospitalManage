# Beta 测试验收报告（admin 前端 + 后端管理页）

## 1. 测试概述
目标：在 Beta 阶段验证管理员端（前端管理界面 `backend/admin-vite`）与后端管理 API（`backend`）在功能、可用性、安全与与数据库交互方面的可用性与稳定性，识别关键缺陷并给出改进/整改建议与责任划分。

## 2. 测试范围
- 前端：管理员登录、医生/科室管理、排班管理、审核流程、日志/审计显示、表单校验与静态资源加载。
- 后端：管理相关 API（创建/更新/删除医生、排班、审核接口）、认证/权限、数据库读写、`ensure-db` 初始化、与通知/消息队列的交互（若在测试环境可用）。

## 3. 测试环境
- 操作系统：Windows 11（本地） + Ubuntu（CI 参考）
- Node.js：18.x，npm 9.x
- 数据库：MySQL 8.0（local 或 docker-compose）
- 浏览器：Chrome 118（主测）、Edge 118（回归）
- 后端运行：`node backend/index.js`（开发）或 Docker Compose 启动服务
- 前端构建：`npm --prefix backend/admin-vite ci && npm --prefix backend/admin-vite run build`，静态文件位于 `backend/admin-vite/dist`

## 4. 测试流程与主要用例（执行方式：手动 + 若干自动化脚本）
- 登录与权限
  - TC-LOGIN-01: 管理员正确凭证登录 → 返回 200 并跳转管理首页
  - TC-LOGIN-02: 非法/过期 token 访问受限接口 → 返回 401/403
- 医生管理
  - TC-DOC-01: 新建医生（含必填/可选字段） → DB 插入、返回新记录 ID
  - TC-DOC-02: 编辑医生信息 → 更新生效并前端实时刷新
  - TC-DOC-03: 删除医生 → 软删或真删按预期（取决于业务规则）
- 排班管理
  - TC-SCHED-01: 新建排班 → 正确计算可预约量
  - TC-SCHED-02: 碰撞/重叠排班校验 → 返回友好错误
- 审核流程
  - TC-AUDIT-01: 提交审核 → 审核记录创建并能被管理员通过/拒绝
- 表单与 UX
  - TC-FORM-01: 缺失必填字段提交 → 前端阻止并高亮，后端返回校验错误
- 数据一致性与 DB
  - TC-DB-01: 批量操作（例如批量导入医生）后数据一致性验证
- 静态资源与路由
  - TC-FRONT-01: 访问任意 admin 路径（例如 /admin/dashboard）应返回 `index.html`（SPA fallback）
- 健康/初始化
  - TC-HEALTH-01: 运行 `npm --prefix backend run ensure-db` 在可用 DB 时正确初始化表

## 5. 执行结果（摘要表）
- TC-LOGIN-01 — 通过：前端登录成功，后端返回 JWT，权限校验生效。
- TC-LOGIN-02 — 通过：非法 token 被拦截，返回 401。
- TC-DOC-01 — 通过：新建医生并在 `accounts`/`doctors` 表中查到记录。
- TC-DOC-02 — 通过：信息更新生效，但前端列表刷新需手动刷新一次（可优化）。
- TC-DOC-03 — 通过（软删）：删除后在列表隐藏，数据库保留记录（符合当前实现）。
- TC-SCHED-01 — 通过：排班数量计算正确。
- TC-SCHED-02 — 不通过：在边缘重叠时后端返回 500（应返回可读的验证错误）。
- TC-AUDIT-01 — 通过：审核流转正常，审核记录写入 `audit` 表。
- TC-FORM-01 — 部分不通过：个别表单字段未触发前端高亮（见实用性报告），后端校验仍生效。
- TC-DB-01 — 通过：批量导入后数据一致性校验通过（小批量测试）；大批量未做压力测试。
- TC-FRONT-01 — 初始部署出现 404（Vercel 配置问题），后已修正为 SPA fallback 并验证本地 `dist` 加载正常（手工验证）。
- TC-HEALTH-01 — 部分不通过：在未启动 MySQL 或 Docker 引擎不可用时 `ensure-db` 抛出连接错误（需增加重试/等待逻辑）。

## 6. 总体评估
- 结论：Beta 测试结果为“部分通过”。核心功能（登录、医生管理、基础排班、审核）正常可用；发现若干需在下一版本修复的缺陷，集中在错误返回可读性、前端表单体验与对 DB/容器不可用的耐受性上。

## 7. 若通过——下一版本改进建议（适用于已通过项）
- 提升前端体验：自动刷新列表或使用 WebSocket/长轮询推送变更，减少手动刷新步骤（负责：前端，@前端；期限：2 周）。
- 性能与可观测：增加关键 API（挂号/排班）的 APM 指标与慢查询日志采集（负责：后端/运维，@后端/@运维；期限：2 周）。

## 8. 若不通过——整改建议（针对不通过项）
- 针对 TC-SCHED-02（重叠排班返回 500）：
  - 问题：后端在校验冲突时抛出未捕获异常，导致 500。
  - 整改：增加排班冲突校验逻辑的边界处理，统一返回 4xx 验证错误并提供冲突详情（责任：后端，@后端；期限：3 个工作日）。
- 针对 TC-FORM-01（前端表单高亮缺失）：
  - 问题：部分表单字段未正确绑定前端校验样式。
  - 整改：统一前端表单校验组件与样式，补充 E2E 用例覆盖（责任：前端，@前端；期限：3 个工作日）。
- 针对 TC-HEALTH-01（`ensure-db` 在 DB 不可用时失败）：
  - 问题：`ensure-db` 未实现重试/等待策略，且 Docker Compose 未提供 health-check 等待逻辑。
  - 整改：在 `scripts/ensure_db.js` 中加入连接重试与超时退避；在 `docker-compose.yml` 添加 `healthcheck` 并在 `dev-compose.ps1` 中等待 DB 健康后再执行初始化（责任：后端 + DevOps，@后端/@DevOps；期限：4 个工作日）。

## 9. 风险与优先级
- 高优先级（需优先修复）：排班冲突 500（影响预约准确性）、`ensure-db` 初始化失败（影响开发/CI 环境）。
- 中优先级：表单 UX 小问题、列表自动刷新优化。
- 低优先级：前端 chunk 优化（构建体积较大），可以在下一次迭代中安排性能优化。

## 10. 责任划分（建议）
- @后端：修复排班冲突校验、`ensure-db` 重试与 DB 健康等待、统一错误返回格式。
- @前端：修复表单高亮与错误提示一致性、实现自动刷新或变更推送。
- @DevOps：完善 `dev-compose.ps1`（修复编码/重复问题）、在 `docker-compose.yml` 添加 healthchecks、更新部署文档（`vercel.json` 说明）。
- @测试：补充 E2E 与兼容性用例，验证整改效果并在 CI 中加入回归测试。

## 11. 附录 — 关键复现命令与日志位置
- 构建 admin 前端（本地验证）：
```bash
npm --prefix backend/admin-vite ci
npm --prefix backend/admin-vite run build
# 产物： backend/admin-vite/dist
```
- 本地启动后端（调试）：
```bash
npm --prefix backend install
node backend/index.js
# 或: npm --prefix backend start
```
- 初始化 DB（需可用 MySQL）：
```bash
npm --prefix backend run ensure-db
```
- Docker Compose 启动（需 Docker Desktop 正常运行）：
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up --build -d
```
- 主要日志位置：`backend/logs/`（若有），PowerShell 脚本日志：`scripts/dev-compose.log` 与 `scripts/dev-compose.err`。

