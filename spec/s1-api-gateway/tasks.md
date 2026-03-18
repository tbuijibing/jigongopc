# S1-API-Gateway: API网关+统一响应 — Tasks

> 总工时: 7d | 状态: 🔧 部分完成

## 任务列表

### Task 1: 统一响应类 PmResult + PmPagination
- **依赖**: s1-project-setup Task 2
- **工时**: 0.5d
- [x] 创建 PmResult<T> 类，实现 ok() / ok(data) / page(IPage) / fail(code, msg) / fromR(R)
- [x] 创建 PmPagination 类（current, size, total）
- [ ] 单元测试覆盖所有静态方法

### Task 2: 错误码枚举 PmErrorCode
- **依赖**: Task 1
- **工时**: 0.5d
- [x] 创建 PmErrorCode 枚举（通用错误码 + 业务错误码分段）
- [x] 创建 ServiceException 扩展类，支持传入 PmErrorCode

### Task 3: 全局异常处理器
- **依赖**: Task 1, Task 2
- **工时**: 0.5d
- [x] 创建 PmExceptionHandler（@RestControllerAdvice）
- [x] 处理 ServiceException / MethodArgumentNotValidException / AuthorizationException / 404 / 500
- [x] 所有异常写入 blade_log_error 表

### Task 4: 多语言拦截器 I18nInterceptor + I18nContext
- **依赖**: s1-project-setup 完成
- **工时**: 1d
- [x] 创建 I18nContext 工具类（ThreadLocal 存储 language / autoTranslate / countryCode）
- [x] 创建 I18nInterceptor（HandlerInterceptor），解析请求头
- [x] 在 WebMvcConfigurer 中注册拦截器

### Task 5: 翻译字段自动注入（@I18nField + MyBatis 拦截器）
- **依赖**: Task 4
- **工时**: 2d
- [x] 创建 @I18nField 注解
- [x] 创建 I18nMyBatisInterceptor，拦截 ResultSetHandler
- [x] 降级策略：目标语言不存在 → en → 原始值
- [x] Redis 缓存翻译结果（TTL 10分钟）

### Task 6: Knife4j Swagger 配置
- **依赖**: s1-project-setup 完成
- **工时**: 0.5d
- [x] 添加 knife4j-openapi2-spring-boot-starter 依赖
- [x] 创建 SwaggerConfig 配置类，按模块创建 Docket 分组
- [x] 配置全局请求头参数
- [x] 访问 `/doc.html` 正常显示

### Task 7: Controller 注解规范 + 示例
- **依赖**: Task 6
- **工时**: 0.5d
- [ ] 编写 Controller Swagger 注解规范文档
- [x] 创建示例 Controller 演示标准写法

### Task 8: 请求限流（@RateLimit 注解）
- **依赖**: Task 3
- **工时**: 1d
- [x] 创建 @RateLimit 注解
- [x] 创建 RateLimitAspect（Redis INCR + EXPIRE 滑动窗口）
- [x] 在登录接口标注限流规则
- [x] 全局默认限流：同一 IP 每分钟 200 次

### Task 9: API 请求日志
- **依赖**: Task 3
- **工时**: 0.5d
- [x] 创建 ApiLogAspect（AOP 切面）
- [x] 记录 URL、HTTP方法、客户端IP、请求耗时、响应状态码
- [x] 耗时 > 2秒标记为慢接口
- [x] 异步写入 blade_log_api 表

### Task 10: 健康检查 + 版本接口
- **依赖**: Task 1
- **工时**: 0.5d
- [x] GET /api/v1/health — 检查 MySQL + Redis 连接
- [x] GET /api/v1/version — 返回版本号、构建时间、Git commit hash
