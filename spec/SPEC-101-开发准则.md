# SPEC-101 开发准则 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

## 一、代码规范

### 1.1 Java 编码规范

#### 1.1.1 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类名 | 大驼峰 | CompanyController |
| 接口 | 大驼峰，I 前缀 | ICompanyService |
| 实现类 | 大驼峰，Impl 后缀 | CompanyServiceImpl |
| 方法名 | 小驼峰 | getCompanyById |
| 变量名 | 小驼峰 | companyName |
| 常量名 | 全大写，下划线 | DEFAULT_PAGE_SIZE |
| 包名 | 全小写，单数 | com.jigongopc.service.controller |

#### 1.1.2 代码格式

规范要点：
- 左大括号不换行
- 运算符两侧空格
- 一行一个变量
- 缩进 4 个空格

#### 1.1.3 注释规范

- 类/接口：Javadoc 格式，包含@author 和@since
- 方法：Javadoc 格式，包含@param 和@return
- 字段：单行注释说明用途

### 1.2 分层规范

#### 1.2.1 Controller 层

规范要点：
- 使用 @RestController 标注
- 路径统一/api/模块名 前缀
- 使用 @PreAuth 进行权限控制
- 参数校验使用 @Validated
- 返回值统一使用 R<T> 包装

#### 1.2.2 Service 层

规范要点：
- 接口以 I 前缀
- 继承 MyBatis Plus 的 IService
- 方法命名清晰表达意图
- DTO 参数区分创建/更新场景

#### 1.2.3 Mapper 层

规范要点：
- 继承 BaseMapper<T>
- 复杂查询使用@Select 注解或 XML
- SQL 使用文本块（Java 17+）

#### 1.2.4 Entity 层

规范要点：
- 使用 @TableName 指定表名
- 使用 @ApiModelProperty 添加文档
- 继承 BaseEntity 获取审计字段
- 使用 serialVersionUID 支持序列化

### 1.3 异常处理

#### 1.3.1 业务异常类

- 继承 RuntimeException
- 包含错误码和错误消息
- 提供静态辅助方法 isTrue/isNull

#### 1.3.2 异常码定义

- 公司管理模块：40001-40099
- Agent 管理模块：40101-40199
- 任务管理模块：40201-40299
- 目标管理模块：40301-40399
- 成本预算模块：40401-40499
- 审批治理模块：40501-40599

#### 1.3.3 全局异常处理器

- 使用 @RestControllerAdvice
- BusinessException 返回 400
- ValidationException 返回 400
- 未知 Exception 返回 500

---

## 二、Vue 编码规范

### 2.1 组件结构

使用 <script setup> 语法，采用 Composition API。

规范要点：
- 模板使用语义化标签
- 样式使用 scoped SCSS
- 逻辑拆分为 composable 函数
- i18n 使用 useI18n hook

### 2.2 组件命名

| 类型 | 规范 | 示例 |
|------|------|------|
| 页面组件 | 小写，连字符 | company-list.vue |
| 业务组件 | 大驼峰 | CompanyForm.vue |
| 通用组件 | 大驼峰 | BaseTable.vue |

### 2.3 API 客户端

- 文件位置：src/api/jigongopc/*.js
- 命名：小写，连字符，如 company.js
- 函数：驼峰命名，如 getCompanyList
- 统一使用 request 工具封装

---

## 三、Git 规范

### 3.1 分支管理

main          # 主分支，保护分支
├── develop   # 开发分支
├── feature/xxx  # 功能分支
├── bugfix/xxx   # 修复分支
└── release/v1.0 # 发布分支

### 3.2 提交规范

格式：<type>(<scope>): <subject>

Type 类型：
- feat: 新功能
- fix: Bug 修复
- docs: 文档更新
- style: 代码格式
- refactor: 重构
- test: 测试
- chore: 构建/工具

示例：
feat(company): 添加公司创建功能

- 实现公司创建 API
- 添加公司名称唯一性校验

Closes #123

### 3.3 代码审查

- 所有代码必须经过 Code Review
- PR 必须关联 Issue
- CI 必须通过
- 至少 1 人 Approve

---

## 四、数据库规范

### 4.1 DDL 规范

- 表名：t_* 前缀，小写，下划线分隔
- 主键：id BIGSERIAL PRIMARY KEY
- 审计字段：create_user, create_time, update_user, update_time
- 软删除：is_deleted BOOLEAN DEFAULT FALSE
- 注释：必须添加表和字段注释

### 4.2 索引规范

- 唯一索引：uk_* 前缀
- 普通索引：idx_* 前缀
- 联合索引：idx_*_xxx_yyy 格式

### 4.3 SQL 编写规范

- 使用显式 JOIN，禁止隐式 JOIN
- 禁止 SELECT *，明确字段列表
- 使用参数化查询，防止 SQL 注入
- 大数据量查询使用分页

---

## 五、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
