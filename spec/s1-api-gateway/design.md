# S1-API-Gateway: API网关+统一响应 — Design

## 1. URL 路由规范

### 模块划分

```
/api/v1/auth/          # 认证模块（登录/注册/Token刷新）
/api/v1/user/          # 用户模块（个人信息/VIP/积分/签到）
/api/v1/map/           # 地图模块（地点/分类/区域/技师）
/api/v1/booking/       # 预约模块（需求/报价/订单/评价）
/api/v1/im/            # IM模块（会话/消息/翻译设置）
/api/v1/affiliate/     # 分销模块（代理/佣金/提现）
/api/v1/payment/       # 支付模块（支付/退款/订阅）
/api/v1/content/       # 内容模块（攻略/打卡/视频/动态）
/api/v1/system/        # 系统模块（字典/参数/配置）
```

### RESTful 约定

```
GET    /api/v1/map/shops              # 列表查询（支持分页/筛选）
POST   /api/v1/map/shops              # 新增
GET    /api/v1/map/shops/{id}         # 详情
PUT    /api/v1/map/shops/{id}         # 更新
DELETE /api/v1/map/shops/{id}         # 删除
PUT    /api/v1/booking/orders/{id}/accept   # 子操作（动词）
```

### Nginx 路由转发

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080/;
    # 后端 Controller 的 @RequestMapping 直接使用 /api/v1/xxx
}
```

## 2. 统一响应格式

### 响应类 PmResult

```java
package com.playmap.common.result;

@Data
public class PmResult<T> implements Serializable {
    private int code;           // 业务状态码
    private boolean success;    // 是否成功
    private String msg;         // 提示信息
    private T data;             // 业务数据
    private PmPagination pagination;  // 分页信息（列表接口才有）

    // 成功 - 无数据
    public static <T> PmResult<T> ok() {
        return ok(null, "操作成功");
    }

    // 成功 - 带数据
    public static <T> PmResult<T> ok(T data) {
        return ok(data, "操作成功");
    }

    // 成功 - 带数据和消息
    public static <T> PmResult<T> ok(T data, String msg) {
        PmResult<T> r = new PmResult<>();
        r.code = 200;
        r.success = true;
        r.msg = msg;
        r.data = data;
        return r;
    }

    // 成功 - 分页列表
    public static <T> PmResult<List<T>> page(IPage<T> page) {
        PmResult<List<T>> r = ok(page.getRecords());
        r.pagination = new PmPagination(
            page.getCurrent(), page.getSize(), page.getTotal()
        );
        return r;
    }

    // 失败
    public static <T> PmResult<T> fail(int code, String msg) {
        PmResult<T> r = new PmResult<>();
        r.code = code;
        r.success = false;
        r.msg = msg;
        return r;
    }

    // 兼容 BladeX R 类
    public static <T> PmResult<T> fromR(R<T> bladeR) {
        if (bladeR.isSuccess()) return ok(bladeR.getData(), bladeR.getMsg());
        return fail(bladeR.getCode(), bladeR.getMsg());
    }
}

@Data
@AllArgsConstructor
public class PmPagination implements Serializable {
    private long current;   // 当前页
    private long size;      // 每页条数
    private long total;     // 总记录数
}
```

### 响应示例

```json
// 成功 - 单条
{
  "code": 200,
  "success": true,
  "msg": "操作成功",
  "data": { "id": 1, "name": "Lila Thai Massage", "rating": 4.9 }
}

// 成功 - 分页列表
{
  "code": 200,
  "success": true,
  "msg": "操作成功",
  "data": [
    { "id": 1, "name": "Lila Thai Massage" },
    { "id": 2, "name": "Let's Relax Spa" }
  ],
  "pagination": { "current": 1, "size": 20, "total": 156 }
}

// 失败
{
  "code": 400,
  "success": false,
  "msg": "手机号格式不正确",
  "data": null
}
```

## 3. 错误码体系

```java
public enum PmErrorCode {
    // 通用
    SUCCESS(200, "操作成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "请先登录"),
    FORBIDDEN(403, "无权访问"),
    NOT_FOUND(404, "资源不存在"),
    TOO_MANY_REQUESTS(429, "请求过于频繁"),
    INTERNAL_ERROR(500, "服务器内部错误"),

    // 认证 1xxx
    TOKEN_EXPIRED(1001, "登录已过期"),
    TOKEN_INVALID(1002, "无效的Token"),
    ACCOUNT_DISABLED(1003, "账号已被禁用"),
    SMS_CODE_ERROR(1004, "验证码错误"),
    SMS_CODE_EXPIRED(1005, "验证码已过期"),

    // 用户 2xxx
    USER_NOT_FOUND(2001, "用户不存在"),
    VIP_EXPIRED(2002, "VIP已过期"),
    POINTS_NOT_ENOUGH(2003, "积分不足"),

    // 地图 3xxx
    SHOP_NOT_FOUND(3001, "地点不存在"),
    SHOP_AUDIT_PENDING(3002, "地点审核中"),

    // 预约 4xxx
    DEMAND_EXPIRED(4001, "需求已过期"),
    ORDER_STATUS_ERROR(4002, "订单状态不允许此操作"),
    COACH_NOT_AVAILABLE(4003, "技师不可用"),

    // 支付 5xxx
    PAYMENT_FAILED(5001, "支付失败"),
    REFUND_FAILED(5002, "退款失败"),

    // IM 6xxx
    CONVERSATION_NOT_FOUND(6001, "会话不存在"),
    ;

    private final int code;
    private final String msg;
}
```

## 4. 多语言请求头处理

### 拦截器

```java
@Component
public class I18nInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) {
        // 解析请求头
        String acceptLang = request.getHeader("Accept-Language");
        String autoTranslate = request.getHeader("X-Auto-Translate");
        String countryCode = request.getHeader("X-Country-Code");

        // 设置到 ThreadLocal（供 Service 层使用）
        I18nContext.setLanguage(
            StringUtils.isNotBlank(acceptLang) ? acceptLang : "en"
        );
        I18nContext.setAutoTranslate(autoTranslate);
        I18nContext.setCountryCode(countryCode);

        return true;
    }

    @Override
    public void afterCompletion(...) {
        I18nContext.clear();  // 清理 ThreadLocal
    }
}
```

### I18nContext 工具类

```java
public class I18nContext {
    private static final ThreadLocal<String> LANGUAGE = new ThreadLocal<>();
    private static final ThreadLocal<String> AUTO_TRANSLATE = new ThreadLocal<>();
    private static final ThreadLocal<String> COUNTRY_CODE = new ThreadLocal<>();

    public static String getLanguage() {
        return Optional.ofNullable(LANGUAGE.get()).orElse("en");
    }
    // ... setter/getter/clear
}
```

### 翻译查询 MyBatis 拦截器

```java
// 自动将 _translations 表的对应语言字段注入查询结果
// 通过 @I18nField 注解标记需要翻译的字段
@I18nField(table = "shops_translations", foreignKey = "shop_id")
private String name;

// MyBatis 拦截器在查询后自动 LEFT JOIN translations 表
// 根据 I18nContext.getLanguage() 获取对应语言翻译
// 如果翻译不存在，降级到 en，再降级到原始值
```

## 5. 全局异常处理

```java
@RestControllerAdvice
public class PmExceptionHandler {

    @ExceptionHandler(ServiceException.class)
    public PmResult<?> handleServiceException(ServiceException e) {
        log.warn("业务异常: {}", e.getMessage());
        return PmResult.fail(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public PmResult<?> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
            .map(f -> f.getField() + ": " + f.getDefaultMessage())
            .collect(Collectors.joining("; "));
        return PmResult.fail(400, msg);
    }

    @ExceptionHandler(AuthorizationException.class)
    public PmResult<?> handleAuth(AuthorizationException e) {
        return PmResult.fail(401, "请先登录");
    }

    @ExceptionHandler(Exception.class)
    public PmResult<?> handleUnknown(Exception e) {
        log.error("未知异常", e);
        // 生产环境不暴露堆栈
        String msg = isProduction() ? "服务器内部错误" : e.getMessage();
        return PmResult.fail(500, msg);
    }
}
```

## 6. Knife4j 配置

```java
@Configuration
@EnableSwagger2WebMvc
public class SwaggerConfig {

    @Bean
    public Docket authApi() {
        return createDocket("认证模块", "com.playmap.auth.controller");
    }

    @Bean
    public Docket userApi() {
        return createDocket("用户模块", "com.playmap.user.controller");
    }

    @Bean
    public Docket mapApi() {
        return createDocket("地图模块", "com.playmap.map.controller");
    }

    @Bean
    public Docket bookingApi() {
        return createDocket("预约模块", "com.playmap.booking.controller");
    }

    @Bean
    public Docket imApi() {
        return createDocket("IM模块", "com.playmap.im.controller");
    }

    @Bean
    public Docket affiliateApi() {
        return createDocket("分销模块", "com.playmap.affiliate.controller");
    }

    private Docket createDocket(String groupName, String basePackage) {
        return new Docket(DocumentationType.SWAGGER_2)
            .groupName(groupName)
            .apiInfo(apiInfo())
            .select()
            .apis(RequestHandlerSelectors.basePackage(basePackage))
            .paths(PathSelectors.any())
            .build()
            .globalRequestParameters(globalHeaders());
    }

    private List<RequestParameter> globalHeaders() {
        return Arrays.asList(
            header("Accept-Language", "语言偏好（zh-CN/en/ja/ko/th等）"),
            header("X-Country-Code", "国家代码（US/TH/JP等）"),
            header("X-Auto-Translate", "IM自动翻译目标语种")
        );
    }
}
```

## 7. 请求限流

```java
// 基于 Redis 的滑动窗口限流
@Aspect
@Component
public class RateLimitAspect {

    @Around("@annotation(rateLimit)")
    public Object around(ProceedingJoinPoint pjp, RateLimit rateLimit) {
        String ip = RequestUtil.getClientIp();
        String key = "rate:" + rateLimit.key() + ":" + ip;
        long count = redisTemplate.opsForValue().increment(key);
        if (count == 1) {
            redisTemplate.expire(key, rateLimit.window(), TimeUnit.SECONDS);
        }
        if (count > rateLimit.max()) {
            throw new ServiceException(429, "请求过于频繁，请稍后再试");
        }
        return pjp.proceed();
    }
}

// 使用示例
@RateLimit(key = "login", max = 10, window = 60)  // 每分钟最多10次
@PostMapping("/api/v1/auth/login")
public PmResult<?> login(@RequestBody LoginDTO dto) { ... }
```

## 8. 请求日志

```java
@Aspect
@Component
public class ApiLogAspect {

    @Around("execution(* com.playmap..controller..*(..))")
    public Object logApi(ProceedingJoinPoint pjp) {
        long start = System.currentTimeMillis();
        String url = RequestUtil.getRequestUrl();
        String method = RequestUtil.getMethod();
        String ip = RequestUtil.getClientIp();

        Object result = pjp.proceed();

        long elapsed = System.currentTimeMillis() - start;
        // 慢接口告警
        if (elapsed > 2000) {
            log.warn("慢接口: {} {} {}ms", method, url, elapsed);
        }
        // 记录到 blade_log_api
        logService.saveApiLog(url, method, ip, elapsed, getStatusCode(result));
        return result;
    }
}
```
