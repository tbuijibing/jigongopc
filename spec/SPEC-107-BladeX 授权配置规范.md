# SPEC-107 BladeX 授权配置规范 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

## 一、BladeX 授权说明

### 1.1 授权模式

BladeX 采用商业授权模式，需要获取正版授权才能用于生产环境。

**官方资源**：
- BladeX 官网：https://bladex.cn
- BladeX 技术社区：https://sns.bladex.cn
- BladeX 中央仓库：https://center.javablade.com

### 1.2 授权获取

1. 访问 BladeX 官网获取授权许可
2. 获取授权 License 文件
3. 配置到项目中

---

## 二、Token 令牌配置（必须）

### 2.1 配置要求

BladeX 4.8.0.RELEASE 必须配置 `sign-key`，否则无法启动。

### 2.2 配置位置

**方式一**：BladeX-Boot 工程修改 `application.yaml`

```yaml
# BladeX-Boot 工程
blade:
  token:
    sign-key: 请配置 32 位签名，签名格式为字母大小写与数字混合排列，总长度 32 位以上
```

**方式二**：BladeX 工程修改 Nacos 服务 `blade.yaml`

```yaml
# Nacos 配置中心 - blade.yaml
blade:
  token:
    sign-key: 请配置 32 位签名，签名格式为字母大小写与数字混合排列，总长度 32 位以上
```

### 2.3 本项目的配置

在 `jigongopc-auth` 模块的 `application-dev.yml` 中配置：

```yaml
# backend/jigongopc-auth/src/main/resources/application-dev.yml
blade:
  token:
    sign-key: ${BLADEX_TOKEN_SIGN_KEY:请替换为 32 位以上随机签名}
    secret-key: ${BLADEX_TOKEN_SECRET_KEY:请替换为 32 位以上密钥}
    ttl: 7200  # Token 有效期（秒），默认 2 小时
    refresh-ttl: 604800  # Refresh Token 有效期（秒），默认 7 天
```

### 2.4 环境变量配置

生产环境建议使用环境变量：

```bash
# .env 配置
BLADEX_TOKEN_SIGN_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6  # 32 位以上
BLADEX_TOKEN_SECRET_KEY=x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4  # 32 位以上
```

### 2.5 签名生成工具

可以使用以下工具生成随机签名：

```java
public class SignKeyGenerator {
    public static String generate() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        Random random = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 32; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
```

### 2.6 验证配置

配置完成后，使用以下 token 测试接口调用：

```
bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9...
```

如果接口返回未授权则表示修改成功。

---

## 三、SQL 防注入配置

### 3.1 版本说明

BladeX 4.8.0.RELEASE 已内置 SQL 防注入功能，无需额外配置。

### 3.2 SqlKeyword 类

如需自定义，可覆盖以下类：
- 路径：`org.springblade.core.mp.support.SqlKeyword`

### 3.3 覆盖方式

在 `jigongopc-common` 模块创建同目录类进行覆盖：

```java
package org.springblade.core.mp.support;

public class SqlKeyword extends org.springblade.core.mp.support.SqlKeyword {
    // 自定义 SQL 关键字过滤规则
}
```

---

## 四、数据导出功能配置

### 4.1 权限要求

数据导出功能必须添加管理员权限控制。

### 4.2 注解使用

```java
@GetMapping("export-user")
@PreAuth(RoleConstant.HAS_ROLE_ADMIN)
public void exportUser(@RequestParam Map<String, Object> user, 
                       BladeUser bladeUser, 
                       HttpServletResponse response) {
    // 数据导出逻辑
}
```

### 4.3 本项目的导出接口

所有涉及数据导出的接口必须添加 `@PreAuth(RoleConstant.HAS_ROLE_ADMIN)` 注解。

---

## 五、系统日志功能配置

### 5.1 日志模块保护

以下模块的 `list` 接口需要添加管理员权限：
- `LogApi` - 操作日志 API
- `LogError` - 错误日志 API
- `LogUtil` - 日志工具 API

### 5.2 配置方式

```java
@RestController
@RequestMapping("api/log")
public class LogApiController {
    
    @GetMapping("list")
    @PreAuth(RoleConstant.HAS_ROLE_ADMIN)
    public R<IPage<Log>> list(@RequestParam Map<String, Object> params) {
        // ...
    }
}
```

---

## 六、错误日志屏蔽配置

### 6.1 环境区分

生产环境（prod）需屏蔽详细错误信息。

### 6.2 配置文件

```yaml
# application-prod.yml
blade:
  log:
    enabled: false  # 生产环境关闭详细日志
```

### 6.3 异常处理器

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(Exception.class)
    public R<Void> handleException(Exception e, 
                                   @Value("${spring.profiles.active:dev}") String env) {
        if ("prod".equals(env)) {
            // 生产环境统一返回通用错误消息
            return R.fail(500, "服务器异常，请联系管理员");
        }
        // 开发环境返回详细错误
        return R.fail(500, e.getMessage());
    }
}
```

---

## 七、重要 API 防止越权

### 7.1 数据权限

使用 `@DataScope` 注解控制数据访问范围：

```java
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

### 7.2 接口权限

使用 `@PreAuth` 注解控制接口访问：

```java
@PreAuth(RoleConstant.HAS_ROLE_ADMIN)
public void deleteCompany(Long id) {
    // 删除公司
}
```

### 7.3 统一权限配置

可以通过配置文件统一保护重要 API：

```yaml
blade:
  security:
    api-protect:
      enabled: true
      patterns:
        - path: /api/company/**
          roles: admin
        - path: /api/agent/**
          roles: admin
        - path: /api/task/**
          roles: admin,user
```

---

## 八、系统部署安全

### 8.1 Actuator 端点保护

Nginx 反向代理配置：

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    # SSL 配置
    ssl_certificate /etc/certs/yourdomain.crt;
    ssl_certificate_key /etc/certs/yourdomain.key;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # 保护 actuator 端点
    if ($request_uri ~ "/actuator") {
        return 403;
    }
}
```

### 8.2 HTTPS 强制

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 8.3 跨域配置

```nginx
add_header Access-Control-Allow-Origin *;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
add_header Access-Control-Allow-Headers "DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization,credential,X-Tenant-ID,Blade-Auth,Screen-Token,App-Token";
```

---

## 九、前端安全配置

### 9.1 去除默认密码文案

修改 Saber3 用户管理前端文件 `user.vue`：

```javascript
// 修改 handleReset 方法的弹框文案
handleReset() {
  if (this.selectionList.length === 0) {
    this.$message.warning("请选择至少一条数据");
    return;
  }
  this.$confirm("确定将选择账号密码重置为初始密码？", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  })
  .then(() => {
    return resetPassword(this.ids);
  })
  .then(() => {
    this.$message({
      type: "success",
      message: "操作成功!",
    });
    this.$refs.crud.toggleSelection();
  });
}
```

### 9.2 Token 存储

Saber3 前端将 Token 存储在 `localStorage` 中：

```javascript
// 登录成功后
localStorage.setItem("token", response.data.token);

// API 请求拦截器
axios.interceptors.request.use(config => {
  config.headers["Blade-Auth"] = "Bearer " + localStorage.getItem("token");
  return config;
});
```

---

## 十、安全检查清单

### 10.1 部署前检查

- [ ] sign-key 已配置（32 位以上随机字符串）
- [ ] secret-key 已配置（32 位以上随机字符串）
- [ ] 默认密码文案已修改
- [ ] actuator 端点已保护
- [ ] HTTPS 已启用
- [ ] 数据导出接口已添加权限控制
- [ ] 日志接口已添加权限控制
- [ ] SQL 防注入已启用

### 10.2 代码检查

- [ ] 所有 Controller 接口已添加 `@PreAuth` 注解
- [ ] 涉及租户数据的接口已添加 `@DataScope` 注解
- [ ] 敏感数据已脱敏处理
- [ ] 错误信息生产环境已屏蔽

### 10.3 配置检查

- [ ] 数据库连接使用加密密码
- [ ] Redis 密码已配置
- [ ] JWT 签名密钥已定期更换

---

## 十一、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |

