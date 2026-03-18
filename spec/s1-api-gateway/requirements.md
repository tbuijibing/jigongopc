# S1-API-Gateway: API网关+统一响应 — Requirements

## 概述

建立 PlayMap 2026 后端 API 规范体系，包括 URL 路由规范、统一响应格式、多语言请求头约定、全局异常处理、Knife4j Swagger 文档自动生成。所有前端（UniApp H5/App、Saber 管理后台、TG Bot）统一通过此网关规范与后端交互。

参考: SYSTEM-ARCHITECTURE.md 第23章

---

## 用户故事

### US-1: URL 路由规范
**作为** 前端开发者，**我希望** 所有 API 遵循统一的 URL 命名规范 `/api/v1/{module}/{resource}`，**以便** 接口可预测、易记忆、易维护。

**EARS 验收标准：**
- WHEN 访问任何业务接口 THEN URL 格式为 `/api/v1/{module}/{resource}`（如 `/api/v1/map/shops`）
- WHEN 资源需要 CRUD THEN 遵循 RESTful：GET(查) / POST(增) / PUT(改) / DELETE(删)
- WHEN 资源有子操作 THEN 使用 `/api/v1/{module}/{resource}/{id}/{action}`（如 `/api/v1/booking/orders/123/accept`）
- WHEN 接口需要版本升级 THEN 通过 URL 中的 v1/v2 区分，旧版本保持兼容

### US-2: 统一响应格式
**作为** 前端开发者，**我希望** 所有接口返回统一的 JSON 格式 `{code, success, msg, data, pagination}`，**以便** 前端可以用统一的拦截器处理响应。

**EARS 验收标准：**
- WHEN 接口调用成功 THEN 返回 `{ code: 200, success: true, msg: "操作成功", data: {...} }`
- WHEN 接口返回列表 THEN 包含 `pagination: { current, size, total }`
- WHEN 接口调用失败 THEN 返回 `{ code: 4xx/5xx, success: false, msg: "错误描述", data: null }`
- WHEN 参数校验失败 THEN code=400，msg 包含具体字段错误信息
- WHEN 未认证 THEN code=401，msg="请先登录"
- WHEN 无权限 THEN code=403，msg="无权访问"
- WHEN 资源不存在 THEN code=404
- WHEN 服务器内部错误 THEN code=500，msg 不暴露堆栈信息（生产环境）

### US-3: 多语言请求头
**作为** 全球用户，**我希望** 通过请求头指定语言偏好，接口返回对应语言的内容，**以便** 看到母语化的数据。

**EARS 验收标准：**
- WHEN 请求头包含 `Accept-Language: zh-CN` THEN 接口返回中文内容（从 _translations 表查询）
- WHEN 请求头包含 `Accept-Language: en` THEN 接口返回英文内容
- WHEN 请求头包含 `X-Auto-Translate: ja` THEN IM 消息自动翻译为日语
- WHEN 请求头包含 `X-Country-Code: TH` THEN 按泰国区域过滤数据（国家解锁判断）
- WHEN Accept-Language 缺失 THEN 默认返回英文（en）
- WHEN 请求的语言翻译不存在 THEN 降级返回英文，再降级返回原始语言

### US-4: Knife4j Swagger 文档
**作为** 前后端开发者，**我希望** 所有 API 自动生成 Swagger 文档并通过 Knife4j 界面访问，**以便** 前端可以自助查阅接口定义和在线调试。

**EARS 验收标准：**
- WHEN 访问 `/doc.html` THEN 显示 Knife4j 文档界面
- WHEN 查看接口列表 THEN 按模块分组（用户、地图、预约、IM、分销、系统）
- WHEN 查看接口详情 THEN 包含：请求方法、URL、请求参数、响应示例、错误码说明
- WHEN 在线调试 THEN 可直接发送请求并查看响应
- WHEN 新增 Controller 方法 THEN 自动出现在文档中（基于注解）

### US-5: 全局异常处理
**作为** 后端开发者，**我希望** 所有异常被全局拦截并转换为统一响应格式，**以便** 前端不会收到原始异常堆栈。

**EARS 验收标准：**
- WHEN 业务异常（ServiceException） THEN 返回对应 code + msg
- WHEN 参数校验异常（MethodArgumentNotValidException） THEN 返回 400 + 字段级错误信息
- WHEN 认证异常 THEN 返回 401
- WHEN 权限异常 THEN 返回 403
- WHEN 未知异常 THEN 返回 500 + 通用错误信息，堆栈仅记录日志不返回前端
- WHEN 任何异常 THEN 日志记录完整堆栈（blade_log_error 表）

### US-6: 请求日志与限流
**作为** 运维人员，**我希望** 所有 API 请求有访问日志，关键接口有限流保护，**以便** 监控系统健康和防止滥用。

**EARS 验收标准：**
- WHEN 任何 API 被调用 THEN 记录请求日志（URL、方法、耗时、状态码、IP）
- WHEN 接口耗时 > 2秒 THEN 标记为慢接口，记录到 blade_log_api
- WHEN 同一 IP 1分钟内请求 > 200次 THEN 返回 429 Too Many Requests
- WHEN 登录接口同一 IP 1分钟 > 10次 THEN 触发限流

---

## 非功能需求

| 维度 | 要求 |
|---|---|
| 响应时间 | 普通查询接口 < 200ms，复杂查询 < 500ms |
| 文档覆盖 | 100% Controller 方法有 Swagger 注解 |
| 错误码 | 统一错误码表，前端可根据 code 做国际化提示 |
| 兼容性 | 响应格式兼容 BladeX 原有 R 类 |
