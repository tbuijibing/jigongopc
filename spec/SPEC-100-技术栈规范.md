# SPEC-100 技术栈规范 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

## 一、后端技术栈

### 1.1 核心框架

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 基础框架 | BladeX | 4.8.0.RELEASE | 企业级开发框架 |
| Spring Boot | Spring Boot | 3.2.10 | 应用基础框架 |
| JDK | OpenJDK | 17+ | Java 运行时 |

### 1.2 数据持久层

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| ORM 框架 | MyBatis Plus | 3.5.5 | 数据库 ORM |
| 数据库 | PostgreSQL | 15+ | 主数据库 |
| 连接池 | HikariCP | 5.1.0 | 数据库连接池 |
| 分页插件 | MyBatis Plus Pagination | 3.5.5 | 分页查询 |

### 1.3 认证授权

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 认证模块 | BladeX blade-auth | 4.8.0 | JWT 认证 |
| JWT | Nimbus JWT | 9.37 | Token 生成 |
| 权限注解 | BladeX Security | 4.8.0 | @PreAuth 注解 |
| 数据权限 | BladeX Scope | 4.8.0 | @DataScope 注解 |

### 1.4 缓存中间件

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 分布式缓存 | Redis | 7.x | 缓存/分布式锁 |
| 连接池 | Lettuce | 6.3.0 | Redis 客户端 |
| 序列化 | Jackson | 2.17.0 | JSON 序列化 |
| 缓存框架 | Spring Cache | 3.2.10 | 缓存注解 |

### 1.5 消息队列

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 消息队列 | RocketMQ | 5.1.0 | 异步通信/事件驱动 |
| 客户端 | RocketMQ Spring | 2.2.3 | Spring 集成 |

### 1.6 任务调度

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 调度框架 | XXL-Job | 2.4.0 | 分布式任务调度 |
| 定时任务 | Spring Scheduler | 3.2.10 | 本地定时任务 |

### 1.7 API 网关

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| API 网关 | Blade Gateway | 4.8.0 | 路由/鉴权/限流 |
| 服务发现 | Nacos | 2.3.0 | 服务注册与发现 |
| 服务调用 | OpenFeign | 4.1.0 | 声明式 HTTP 客户端 |
| 熔断降级 | Sentinel | 1.8.7 | 流控/熔断/降级 |

### 1.8 可观测性

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 链路追踪 | SkyWalking | 9.3.0 | 全链路追踪 |
| 日志收集 | Logback + ELK | 最新 | 集中式日志 |
| 指标监控 | Prometheus + Grafana | 最新 | 指标监控告警 |
| 健康检查 | Spring Boot Actuator | 3.2.10 | 健康检查/指标暴露 |

### 1.9 工具库

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| Lombok | Lombok | 1.18.34 | 代码简化 |
| Jackson | Jackson | 2.17.0 | JSON 序列化 |
| MapStruct | MapStruct | 1.5.5 | 对象映射 |
| Hutool | Hutool | 5.8.26 | Java 工具类 |
| Guava | Guava | 33.0.0 | Google 工具库 |

### 1.10 WebSocket 集成

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| WebSocket 客户端 | Java-WebSocket | 1.5.4 | OpenClaw 网关 |
| 响应式流 | Project Reactor | 3.6.3 | Flux/Mono |

---

## 二、前端技术栈

### 2.1 Web 前端核心

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 前端框架 | Saber 3 | 最新 | 基于 Vue 3 |
| Vue | Vue 3 | 3.5.13 | 响应式框架 |
| UI 组件库 | Element Plus | 2.10.1 | 组件库 |
| 表单框架 | Avue | 3.7.2 | 低代码表单 |
| 状态管理 | Vuex | 4.1.0 | 全局状态 |
| 路由管理 | Vue Router | 4.3.2 | SPA 路由 |

### 2.2 国际化

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| i18n | vue-i18n | 11.1.3 | 多语言支持 |
| 语言支持 | zh-CN, en-US, ja-JP, ko-KR, zh-TW, de-DE, fr-FR, es-ES | - | 支持 8 种语言 |
| 后端 i18n | Spring MessageSource | - | ResourceBundleMessageSource |
| 翻译表模式 | 原表 + _translation 表 | - | 业务数据多语言 |

### 2.2.1 前端国际化文件结构

```
src/locales/
├── zh-CN/
│   ├── jigongopc/
│   │   ├── common.json          # 通用文案
│   │   ├── company.json         # 公司模块
│   │   ├── agent.json           # Agent 模块
│   │   ├── task.json            # 任务模块
│   │   └── ...
│   └── element-plus.json        # Element Plus 组件翻译
├── en-US/
├── ja-JP/
└── ko-KR/
```

### 2.2.2 后端国际化文件结构

```
src/main/resources/i18n/
├── messages.properties           # 默认（英文）
├── messages_zh_CN.properties     # 简体中文
├── messages_en_US.properties     # 英文
├── messages_ja_JP.properties     # 日文
└── ...
```

### 2.2.3 业务翻译表结构

```sql
-- 公司翻译表
CREATE TABLE t_company_translation (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    company_id      BIGINT NOT NULL,
    lang            VARCHAR(10) NOT NULL,
    name            VARCHAR(512),
    description     TEXT,
    UNIQUE KEY uk_company_lang (company_id, lang)
);

-- Agent 翻译表
CREATE TABLE t_agent_translation (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id        BIGINT NOT NULL,
    lang            VARCHAR(10) NOT NULL,
    name            VARCHAR(512),
    title           VARCHAR(255),
    description     TEXT,
    UNIQUE KEY uk_agent_lang (agent_id, lang)
);

-- 任务翻译表
CREATE TABLE t_issue_translation (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    issue_id        BIGINT NOT NULL,
    lang            VARCHAR(10) NOT NULL,
    title           VARCHAR(512),
    description     TEXT,
    UNIQUE KEY uk_issue_lang (issue_id, lang)
);
```

### 2.3 HTTP 客户端

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| HTTP 库 | Axios | 1.8.3 | API 请求 |
| 加密 | Crypto-JS | 4.1.1 | 对称加密 |
| 国密 | SM-Crypto | 0.3.13 | 国密加密 |

### 2.4 日期处理

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 日期库 | Dayjs | 1.10.6 | 日期格式化 |
| 时区插件 | dayjs-timezone | 最新 | 时区转换 |
| UTC 插件 | dayjs-utc | 最新 | UTC 处理 |

### 2.5 构建工具

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 构建工具 | Vite | 5.4.19 | 快速构建 |
| 包管理器 | PNPM | 9.x | 依赖管理 |

### 2.6 设计器组件

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 表单设计器 | @saber/nf-form-design-elp | 最新 | 低代码表单设计 |
| 设计基础组件 | @saber/nf-design-base-elp | 最新 | 设计器基础组件 |
| 富文本 | avue-plugin-ueditor | 最新 | 富文本编辑器 |

---

## 三、移动端技术栈

### 3.1 跨平台方案（推荐）

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 跨平台框架 | Uni-app | 最新 | Vue 3 跨平台框架 |
| UI 组件库 | uView UI | 2.0.36 | 移动端组件库 |
| 构建工具 | HBuilderX | 最新 | Uni-app IDE |

### 3.2 原生方案（可选）

| 平台 | 技术选型 | 说明 |
|------|----------|------|
| Android | Kotlin + Jetpack Compose | 安卓原生 |
| iOS | Swift + SwiftUI | iOS 原生 |
| Harmony | ArkTS + ArkUI | 鸿蒙原生 |

---

## 四、桌面端技术栈

### 4.1 Electron

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 桌面框架 | Electron | 29.x | 跨平台桌面框架 |
| 构建工具 | electron-builder | 24.x | 打包工具 |
| 自动更新 | electron-updater | 6.x | 自动更新 |

---

## 五、开发工具

### 5.1 IDE

| 用途 | 工具 | 版本 |
|------|------|------|
| 后端开发 | IntelliJ IDEA | 2024.x |
| 前端开发 | VS Code | 1.87.x |
| 数据库 | DBeaver | 24.x |
| API 调试 | Postman | 11.x |
| 设计工具 | Pencil | 最新 |

### 5.2 代码质量

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 代码格式化 | Spotless | 2.41.0 | 代码格式化 |
| 代码检查 | SonarQube | 10.x | 代码质量 |
| 单元测试 | JUnit 5 | 5.10.0 | 单元测试框架 |
| Mock 框架 | Mockito | 5.10.0 | Mock 测试 |

### 5.3 文档工具

| 组件 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| API 文档 | Swagger/OpenAPI | 3.0 | API 文档 |
| Knife4j | Knife4j | 4.4.0 | Swagger UI 增强 |

---

## 六、数据库规范

### 6.1 表命名

- 表名：`t_*` 前缀，小写，下划线分隔，如 `t_company`
- 主键：`id` BIGINT PRIMARY KEY
- 外键：`xxx_id` BIGINT，如 `company_id`
- 审计字段：`create_user`, `create_time`, `update_user`, `update_time`
- 软删除：`is_deleted` BOOLEAN DEFAULT FALSE

### 6.2 索引规范

- 唯一索引：`uk_*` 前缀，如 `uk_company_name`
- 普通索引：`idx_*` 前缀，如 `idx_company_status`
- 联合索引：`idx_*_xxx_yyy` 格式

### 6.3 数据类型

| 用途 | 类型 | 说明 |
|------|------|------|
| 主键 | BIGSERIAL | 自增主键 |
| 金额（分） | BIGINT | 以分为单位 |
| 状态 | VARCHAR(20) | 状态枚举 |
| 时间 | TIMESTAMPTZ | 带时区时间戳 |
| 布尔 | BOOLEAN | 布尔值 |
| JSON | JSONB | JSON 数据 |

---

## 七、API 规范

### 7.1 RESTful 风格

- GET：查询资源
- POST：创建资源
- PUT：更新资源（全量）
- PATCH：更新资源（部分）
- DELETE：删除资源

### 7.2 路径规范

- 路径：小写，复数名词，如 `/api/companies`
- 参数：路径参数用 `{id}`，查询参数用 `?keyword=xxx`
- 版本：通过路径版本化，如 `/api/v1/companies`

### 7.3 响应格式

```json
{
  "code": 200,
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 7.4 分页响应

```json
{
  "code": 200,
  "success": true,
  "data": {
    "records": [...],
    "total": 100,
    "size": 10,
    "current": 1,
    "pages": 10
  }
}
```

---

## 八、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
