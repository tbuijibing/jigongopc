# SPEC-104 安全性规划 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

**相关文档**：
- [SPEC-107 BladeX 授权配置规范](./SPEC-107-BladeX 授权配置规范.md) - BladeX 正版授权配置详解

---

## 一、认证授权

### 1.1 认证机制

#### 1.1.1 JWT Token

- 使用 BladeX blade-auth 模块
- Token 有效期：2 小时
- Refresh Token 有效期：7 天
- 签名算法：HS256

#### 1.1.2 Token 管理

```yaml
blade:
  token:
    sign-key: 32 位以上字母大小写与数字混合签名（必须配置，详见 SPEC-107）
    secret-key: 32 位以上密钥
    ttl: 7200  # Token 有效期（秒）
    refresh-ttl: 604800  # Refresh Token 有效期（秒）
```

**注意**：`sign-key` 必须配置且长度 32 位以上，否则 BladeX 4.8.0 无法启动。详见 [SPEC-107](./SPEC-107-BladeX 授权配置规范.md)。

#### 1.1.3 认证流程

1. 用户登录：POST /api/auth/login
2. 验证凭证：用户名 + 密码
3. 生成 JWT Token
4. 返回 Token 给用户
5. 前端存储 Token（localStorage）
6. 请求携带 Bearer Token
7. 网关鉴权

### 1.2 授权机制

#### 1.2.1 角色权限

```java
// 管理员角色
@PreAuth(RoleConstant.HAS_ROLE_ADMIN)
public void adminOperation() { }

// 普通用户角色
@PreAuth(RoleConstant.HAS_ROLE_USER)
public void userOperation() { }
```

#### 1.2.2 数据权限

```java
// 数据范围注解
@DataScope(alias = "u")
public List<Company> list() {
    return baseMapper.selectList(null);
}
```

数据权限类型：
- 全部数据权限
- 本部门及以下
- 本部门
- 仅本人

---

## 二、API 安全

### 2.1 API 保护

```yaml
blade:
  security:
    api-protect:
      enabled: true
      exclude-paths:
        - /api/auth/login
        - /api/auth/register
        - /api/captcha
```

### 2.2 限流策略

```java
/**
 * 限流注解
 * 每秒最多 10 次请求
 */
@RateLimiter(value = 10, key = "#userId")
public void createCompany(CompanyDTO dto) {
    // ...
}
```

### 2.3 防重放攻击

- 请求时间戳验证
- 请求 nonce 唯一性检查
- 时间窗口：5 分钟

---

## 三、数据安全

### 3.1 数据隔离

#### 3.1.1 租户隔离

- 通过 tenant_id 实现多公司隔离
- 所有查询自动添加租户条件
- 跨租户访问返回 403

#### 3.1.2 查询拦截器

```java
public class TenantInterceptor implements InnerInterceptor {
    @Override
    public void beforeQuery(Executor executor, MappedStatement ms, Object parameter) {
        // 自动添加 tenant_id 条件
        String tenantId = TenantContextHolder.getTenantId();
        // ...
    }
}
```

### 3.2 数据加密

#### 3.2.1 敏感字段加密

- 密码：BCrypt 加密
- 手机号：AES 加密存储
- 身份证号：AES 加密存储

#### 3.2.2 传输加密

- HTTPS 强制启用
- TLS 1.3
- 敏感数据前端 RSA 加密

### 3.3 数据脱敏

```java
/**
 * 数据脱敏
 */
public class DesensitizeUtil {
    
    // 手机号脱敏
    public static String maskPhone(String phone) {
        return phone.replaceAll("(\d{3})\d{4}(\d{4})", "$1****$2");
    }
    
    // 身份证脱敏
    public static String maskIdCard(String idCard) {
        return idCard.replaceAll("(\d{6})\d{8}(\w{4})", "$1********$2");
    }
}
```

---

## 四、审计日志

### 4.1 日志记录

```java
/**
 * 操作日志注解
 */
@SysLog(value = "创建公司")
public void createCompany(CompanyDTO dto) {
    // ...
}
```

### 4.2 审计内容

| 操作类型 | 记录内容 |
|----------|---------|
| 创建 | 操作人、时间、创建内容 |
| 更新 | 操作人、时间、变更前后 |
| 删除 | 操作人、时间、删除 ID |
| 登录 | 用户、时间、IP 地址 |
| 导出 | 操作人、时间、导出内容 |

### 4.3 日志存储

- 存储位置：t_sys_log 表
- 保存期限：180 天
- 查询接口：仅管理员可查

---

## 五、前端安全

### 5.1 XSS 防护

- 用户输入过滤
- 输出 HTML 转义
- Content-Security-Policy

### 5.2 CSRF 防护

- Token 验证
- SameSite Cookie
- 关键操作二次验证

### 5.3 点击劫持

- X-Frame-Options: DENY
- 敏感操作弹窗确认

---

## 六、安全扫描

### 6.1 依赖扫描

- 使用 OWASP Dependency-Check
- CI 集成安全扫描
- 高危漏洞零容忍

### 6.2 代码扫描

- SonarQube 安全规则
- 敏感信息检测
- SQL 注入检测

### 6.3 渗透测试

- 上线前渗透测试
- 定期安全评估
- 漏洞修复流程

---

## 七、国际化安全

### 7.1 翻译表设计

```sql
-- 国际化翻译表
CREATE TABLE t_i18n_translation (
    id              BIGSERIAL PRIMARY KEY,
    translation_key VARCHAR(255) NOT NULL,
    lang_code       VARCHAR(10) NOT NULL,
    translation_text TEXT NOT NULL,
    module          VARCHAR(50),  -- 模块：business/dictionary/system
    create_time     TIMESTAMPTZ DEFAULT NOW(),
    update_time     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE KEY uk_key_lang (translation_key, lang_code)
);

COMMENT ON COLUMN t_i18n_translation.module IS 模块类型：business=业务字典，dictionary=数据字典，system=系统;
```

### 7.2 业务字典翻译

```sql
-- 业务字典表
CREATE TABLE t_business_dict (
    id              BIGSERIAL PRIMARY KEY,
    dict_type       VARCHAR(50) NOT NULL,
    dict_key        VARCHAR(50) NOT NULL,
    dict_value      VARCHAR(255) NOT NULL,
    parent_id       BIGINT DEFAULT 0,
    sort_order      INT DEFAULT 0,
    is_deleted      BOOLEAN DEFAULT FALSE,
    create_time     TIMESTAMPTZ DEFAULT NOW(),
    update_time     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE KEY uk_type_key (dict_type, dict_key)
);

-- 关联翻译表
ALTER TABLE t_business_dict 
ADD COLUMN translation_key VARCHAR(255);
```

### 7.3 数据字典翻译

```sql
-- 数据字典表（系统级）
CREATE TABLE t_system_dict (
    id              BIGSERIAL PRIMARY KEY,
    dict_name       VARCHAR(100) NOT NULL,
    dict_type       VARCHAR(50) NOT NULL,
    dict_key        VARCHAR(50) NOT NULL,
    dict_value      VARCHAR(255) NOT NULL,
    dict_label      VARCHAR(100),  -- 中文标签
    sort_order      INT DEFAULT 0,
    is_deleted      BOOLEAN DEFAULT FALSE,
    create_time     TIMESTAMPTZ DEFAULT NOW(),
    update_time     TIMESTAMPTZ DEFAULT NOW(),
    translation_key VARCHAR(255),  -- 关联翻译表
    UNIQUE KEY uk_type_key (dict_type, dict_key)
);
```

### 7.4 翻译管理

- 后台管理界面：翻译管理模块
- 支持批量导入/导出
- 支持缺失翻译检测
- 支持翻译版本管理

---

## 八、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
