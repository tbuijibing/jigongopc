# SPEC-111 微服务架构规范 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

## 一、微服务总体架构

### 1.1 架构设计原则

1. **服务拆分**：按业务领域垂直拆分，每个服务独立部署
2. **数据隔离**：每个服务拥有独立数据库，禁止跨库查询
3. **轻量通信**：RESTful API + Feign 调用，异步通信用消息队列
4. **高可用**：服务多实例部署，负载均衡，故障自动转移
5. **可观测性**：全链路追踪、集中式日志、实时监控

### 1.2 服务分层架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           客户端层 (Client Layer)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Web 端     │  │   H5 移动端  │  │  桌面客户端  │  │  移动客户端  │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          └────────────────┴───────┬────────┴────────────────┘
                                   │
                          ┌────────▼────────┐
                          │  API 网关层      │
                          │ Blade Gateway   │
                          │ - 认证鉴权       │
                          │ - 限流熔断       │
                          │ - 路由转发       │
                          │ - 协议转换       │
                          └────────┬────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
   ┌──────▼──────┐          ┌──────▼──────┐         ┌──────▼──────┐
   │ 认证授权中心 │          │   业务服务层  │         │  基础设施层  │
   │ jigongopc-  │          │ jigongopc-  │         │ jigongopc-  │
   │ auth        │          │ service-*   │         │ infra-*     │
   │ (blade-auth)│          │             │         │             │
   └─────────────┘          └──────┬──────┘         └──────┬──────┘
                                   │                        │
                          ┌────────┴────────────────────────┤
                          │                │                │
                 ┌────────▼────┐  ┌───────▼──────┐  ┌──────▼──────┐
                 │  数据持久层  │  │  消息队列层  │  │  缓存层     │
                 │ PostgreSQL  │  │ RocketMQ    │  │ Redis       │
                 │ MyBatis Plus│  │ 事件驱动     │  │ 分布式缓存  │
                 └─────────────┘  └──────────────┘  └─────────────┘
```

### 1.3 服务列表

| 服务名称 | 端口 | 职责 | 数据库 |
|----------|------|------|--------|
| jigongopc-gateway | 8080 | API 网关 | 无 |
| jigongopc-auth | 8100 | 认证授权 | blade_* |
| jigongopc-company | 8201 | 公司管理服务 | jigongopc_company |
| jigongopc-agent | 8202 | Agent 管理服务 | jigongopc_agent |
| jigongopc-task | 8203 | 任务管理服务 | jigongopc_task |
| jigongopc-goal | 8204 | 目标管理服务 | jigongopc_goal |
| jigongopc-cost | 8205 | 成本预算服务 | jigongopc_cost |
| jigongopc-approval | 8206 | 审批治理服务 | jigongopc_approval |
| jigongopc-job | 8300 | 心跳调度服务 | xxl_job + jigongopc_job |

---

## 二、服务注册与发现

### 2.1 Nacos 注册中心

```yaml
# application.yml
spring:
  cloud:
    nacos:
      discovery:
        server-addr: ${NACOS_SERVER:localhost:8848}
        namespace: ${NACOS_NAMESPACE:jigongopc}
        group: ${NACOS_GROUP:DEFAULT_GROUP}
        username: ${NACOS_USERNAME:nacos}
        password: ${NACOS_PASSWORD:nacos}
```

### 2.2 服务元数据

```yaml
spring:
  application:
    name: jigongopc-company  # 服务名
  cloud:
    nacos:
      discovery:
        metadata:
          version: 1.0.0
          description: 公司管理服务
          author: JiGongOpc Team
```

### 2.3 服务健康检查

```yaml
# 健康检查配置
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always
  health:
    db:
      enabled: true
    redis:
      enabled: true
    rabbitmq:
      enabled: true
```

---

## 三、API 网关

### 3.1 网关路由配置

```yaml
# Blade Gateway 配置
blade:
  gateway:
    routes:
      - id: jigongopc-company
        uri: lb://jigongopc-company
        predicates:
          - Path=/api/company/**
        filters:
          - StripPrefix=1
          - AuthFilter
          - RateLimiterFilter

      - id: jigongopc-agent
        uri: lb://jigongopc-agent
        predicates:
          - Path=/api/agent/**
        filters:
          - StripPrefix=1
          - AuthFilter
```

### 3.2 限流配置

```yaml
# 令牌桶限流
spring:
  cloud:
    sentinel:
      enabled: true
      transport:
        dashboard: ${SENTINEL_DASHBOARD:localhost:8080}
      datasource:
        ds1:
          nacos:
            server-addr: ${NACOS_SERVER}
            dataId: ${spring.application.name}-sentinel
            groupId: DEFAULT_GROUP
            ruleType: flow

# 限流规则（Nacos 配置中心）
[
  {
    "resource": "/api/company/**",
    "count": 1000,
    "grade": 1,
    "limitApp": "default",
    "strategy": 0,
    "controlBehavior": 0,
    "burst": 200
  }
]
```

### 3.3 熔断降级配置

```yaml
# Sentinel 熔断配置
spring:
  cloud:
    sentinel:
      datasource:
        degrade:
          nacos:
            server-addr: ${NACOS_SERVER}
            dataId: ${spring.application.name}-degrade
            ruleType: degrade

# 熔断规则
[
  {
    "resource": "jigongopc-company#list",
    "count": 0.5,
    "timeWindow": 10,
    "grade": 1,
    "minRequestAmount": 10,
    "slowRatioThreshold": 0.3,
    "statIntervalMs": 10000
  }
]
```

---

## 四、分布式缓存

### 4.1 Redis 缓存架构

```yaml
# Redis 配置（Spring Data Redis）
spring:
  redis:
    host: ${REDIS_HOST:localhost}
    port: ${REDIS_PORT:6379}
    password: ${REDIS_PASSWORD:}
    database: ${REDIS_DB:0}
    lettuce:
      pool:
        max-active: 16      # 最大连接数
        max-idle: 8         # 最大空闲连接
        min-idle: 2         # 最小空闲连接
        max-wait: 3000ms    # 获取连接最大等待时间
      cluster:
        refresh:
          adaptive: true    # 自适应集群刷新
```

### 4.2 缓存 Key 设计规范

```java
/**
 * 缓存 Key 常量定义
 */
public class CacheKeys {

    // 格式：{命名空间}:{业务前缀}:{ID/关键字}
    private static final String NS = "jgo:";

    // 公司相关
    public static String companyKey(Long id) {
        return NS + "company:" + id;
    }

    public static String companyInfoKey(String name) {
        return NS + "company:info:" + name;
    }

    // Agent 相关
    public static String agentKey(Long id) {
        return NS + "agent:" + id;
    }

    public static String agentStatusKey(Long id) {
        return NS + "agent:status:" + id;
    }

    // 任务相关
    public static String taskKey(Long id) {
        return NS + "task:" + id;
    }

    public static String taskAssigneeKey(Long assigneeId) {
        return NS + "task:assignee:" + assigneeId;
    }

    // 缓存过期时间（单位：秒）
    public static final long CACHE_TTL_5MIN = 300;
    public static final long CACHE_TTL_15MIN = 900;
    public static final long CACHE_TTL_1HOUR = 3600;
    public static final long CACHE_TTL_1DAY = 86400;
    public static final long CACHE_TTL_7DAY = 604800;
}
```

### 4.3 缓存注解使用

```java
@Service
public class CompanyServiceImpl implements CompanyService {

    @Autowired
    private CompanyMapper companyMapper;

    /**
     * 查询公司 - 使用缓存
     * @Cacheable: 先查缓存，缓存不命中则查数据库并写入缓存
     */
    @Cacheable(value = "company", key = "#id", unless = "#result == null")
    @Override
    public CompanyDTO getById(Long id) {
        return companyMapper.selectById(id);
    }

    /**
     * 更新公司 - 删除缓存
     * @CacheEvict: 更新数据库后删除缓存
     */
    @CacheEvict(value = "company", key = "#company.id")
    @Override
    public void update(CompanyDTO company) {
        companyMapper.updateById(company);
    }

    /**
     * 删除公司 - 删除缓存
     */
    @CacheEvict(value = "company", key = "#id")
    @Override
    public void delete(Long id) {
        companyMapper.deleteById(id);
    }

    /**
     * 复杂缓存操作 - 使用 CacheAside 模式
     */
    public CompanyDTO getComplexCompany(Long id) {
        String key = CacheKeys.companyKey(id);

        // 1. 先查缓存
        CompanyDTO cached = redisTemplate.opsForValue().get(key);
        if (cached != null) {
            return cached;
        }

        // 2. 缓存不命中，查数据库
        CompanyDTO company = companyMapper.selectById(id);

        // 3. 写入缓存（设置过期时间，防止缓存穿透）
        if (company != null) {
            redisTemplate.opsForValue().set(
                key,
                company,
                CacheKeys.CACHE_TTL_1HOUR,
                TimeUnit.SECONDS
            );
        } else {
            // 4. 数据库也没有，设置空值缓存（防止缓存穿透）
            redisTemplate.opsForValue().set(
                key,
                null,
                CacheKeys.CACHE_TTL_5MIN,
                TimeUnit.SECONDS
            );
        }

        return company;
    }
}
```

### 4.4 缓存配置类

```java
@Configuration
@EnableCaching
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(
            RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // JSON 序列化配置
        Jackson2JsonRedisSerializer<Object> jackson2JsonRedisSerializer =
            new Jackson2JsonRedisSerializer<>(Object.class);
        ObjectMapper om = new ObjectMapper();
        om.setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.ANY);
        om.activateDefaultTyping(LaissezFaireSubTypeValidator.instance,
            ObjectMapper.DefaultTyping.NON_FINAL);
        jackson2JsonRedisSerializer.setObjectMapper(om);

        // String 序列化
        StringRedisSerializer stringRedisSerializer = new StringRedisSerializer();

        // Key 采用 String 序列化
        template.setKeySerializer(stringRedisSerializer);
        template.setHashKeySerializer(stringRedisSerializer);

        // Value 采用 JSON 序列化
        template.setValueSerializer(jackson2JsonRedisSerializer);
        template.setHashValueSerializer(jackson2JsonRedisSerializer);

        template.afterPropertiesSet();
        return template;
    }

    /**
     * 缓存配置管理器
     */
    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(1))  // 默认过期时间 1 小时
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new StringRedisSerializer()))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();  // 不缓存空值

        // 定义不同缓存的过期时间
        config = config.withInitialCacheConfig(builder -> builder
            .withTtl(Duration.ofMinutes(5), "company")      // 公司缓存 5 分钟
            .withTtl(Duration.ofMinutes(15), "agent")       // Agent 缓存 15 分钟
            .withTtl(Duration.ofHours(1), "task")           // 任务缓存 1 小时
            .withTtl(Duration.ofDays(7), "dict")            // 字典缓存 7 天
            .build());

        return RedisCacheManager.builder(factory)
            .cacheDefaults(config)
            .transactionAware()
            .build();
    }
}
```

### 4.5 分布式锁

```java
@Service
public class DistributedLockService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    /**
     * 尝试获取分布式锁
     * @param lockKey 锁 key
     * @param value   锁 value（通常为 UUID，用于释放锁时验证）
     * @param timeout 超时时间（秒）
     * @return 是否获取成功
     */
    public boolean tryLock(String lockKey, String value, long timeout) {
        String key = "lock:" + lockKey;
        return Boolean.TRUE.equals(redisTemplate.opsForValue()
            .setIfAbsent(key, value, timeout, TimeUnit.SECONDS));
    }

    /**
     * 释放分布式锁
     * @param lockKey 锁 key
     * @param value   锁 value（验证是否为当前锁持有者）
     * @return 是否释放成功
     */
    public boolean unlock(String lockKey, String value) {
        String key = "lock:" + lockKey;

        // Lua 脚本保证原子性
        String script = """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end
            """;

        RedisScript<Long> redisScript = RedisScript.of(script, Long.class);
        Long result = redisTemplate.execute(
            redisScript,
            Collections.singletonList(key),
            value
        );

        return result != null && result > 0;
    }

    /**
     * 使用 try-finally 管理锁
     */
    public <T> T executeWithLock(String lockKey, long timeout, Supplier<T> action) {
        String lockValue = UUID.randomUUID().toString();
        boolean locked = false;

        try {
            locked = tryLock(lockKey, lockValue, timeout);
            if (!locked) {
                throw new RuntimeException("获取锁失败：" + lockKey);
            }
            return action.get();
        } finally {
            if (locked) {
                unlock(lockKey, lockValue);
            }
        }
    }
}
```

---

## 五、消息队列（RocketMQ）

### 5.1 RocketMQ 配置

```yaml
# RocketMQ 配置
rocketmq:
  name-server: ${ROCKETMQ_NAMESERVER:localhost:9876}
  producer:
    group: jigongopc-producer
    send-message-timeout: 3000
    retry-times-when-send-failed: 2
    retry-times-when-send-async-failed: 2
  consumer:
    # 消费者配置
```

### 5.2 消息主题定义

```java
/**
 * RocketMQ 主题常量
 */
public class MqTopics {

    // 公司相关事件
    public static final String COMPANY_CREATED = "jgo_company_created";
    public static final String COMPANY_UPDATED = "jgo_company_updated";
    public static final String COMPANY_DELETED = "jgo_company_deleted";

    // Agent 相关事件
    public static final String AGENT_CREATED = "jgo_agent_created";
    public static final String AGENT_STATUS_CHANGED = "jgo_agent_status_changed";
    public static final String AGENT_HEARTBEAT = "jgo_agent_heartbeat";

    // 任务相关事件
    public static final String TASK_CREATED = "jgo_task_created";
    public static final String TASK_ASSIGNED = "jgo_task_assigned";
    public static final String TASK_STATUS_CHANGED = "jgo_task_status_changed";
    public static final String TASK_COMPLETED = "jgo_task_completed";

    // 审批相关事件
    public static final String APPROVAL_REQUESTED = "jgo_approval_requested";
    public static final String APPROVAL_COMPLETED = "jgo_approval_completed";

    // 预算相关事件
    public static final String BUDGET_ALERT = "jgo_budget_alert";
    public static final String COST_REPORT = "jgo_cost_report";
}
```

### 5.3 消息发送

```java
@Service
@Slf4j
public class MqProducerService {

    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    /**
     * 发送同步消息
     */
    public void sendMessage(String topic, String tags, Object payload) {
        String destination = topic + ":" + tags;
        SendResult result = rocketMQTemplate.syncSend(destination, payload);
        log.info("同步消息发送成功：topic={}, tags={}, msgId={}",
            topic, tags, result.getMsgId());
    }

    /**
     * 发送异步消息
     */
    public void sendAsyncMessage(String topic, String tags,
                                  Object payload, SendCallback callback) {
        String destination = topic + ":" + tags;
        rocketMQTemplate.asyncSend(destination, payload, callback);
    }

    /**
     * 发送延迟消息
     * @param delayLevel RocketMQ 延迟级别（1-18，对应 1s-2h）
     */
    public void sendDelayMessage(String topic, String tags,
                                  Object payload, int delayLevel) {
        Message<?> message = MessageBuilder.withPayload(payload).build();
        String destination = topic + ":" + tags;
        rocketMQTemplate.syncSend(destination, message, 3000, delayLevel);
    }

    /**
     * 发送顺序消息（保证 FIFO）
     */
    public void sendOrderlyMessage(String topic, Object payload, Long orderId) {
        String destination = topic;
        rocketMQTemplate.syncSendOrderly(destination, payload, String.valueOf(orderId));
    }

    /**
     * 发送事务消息
     */
    @TransactionalRocketMQTransactionListener
    class TransactionListenerImpl implements RocketMQLocalTransactionListener {

        @Override
        public RocketMQLocalTransactionState executeLocalTransaction(
                Message<?> message, Object arg) {
            // 执行本地事务
            try {
                // ... 业务逻辑
                return RocketMQLocalTransactionState.COMMIT;
            } catch (Exception e) {
                return RocketMQLocalTransactionState.ROLLBACK;
            }
        }

        @Override
        public RocketMQLocalTransactionState checkLocalTransaction(Message<?> message) {
            // 事务回查
            return RocketMQLocalTransactionState.COMMIT;
        }
    }
}
```

### 5.4 消息消费

```java
@Service
@RocketMQMessageListener(
    topic = MqTopics.TASK_STATUS_CHANGED,
    consumerGroup = "jgo-task-consumer-group",
    messageModel = MessageModel.CLUSTERING,  // 集群消费
    consumeMode = ConsumeMode.ORDERLY,       // 顺序消费
    maxReconsumeTimes = 3
)
public class TaskStatusConsumer implements RocketMQListener<TaskStatusEvent> {

    @Override
    public void onMessage(TaskStatusEvent event) {
        log.info("收到任务状态变更消息：{}", event);

        // 1. 更新缓存
        updateCache(event);

        // 2. 发送实时通知
        sendNotification(event);

        // 3. 记录审计日志
        logAudit(event);
    }

    private void updateCache(TaskStatusEvent event) {
        // 更新缓存逻辑
    }

    private void sendNotification(TaskStatusEvent event) {
        // 发送 WebSocket/SSE 通知
    }

    private void logAudit(TaskStatusEvent event) {
        // 记录审计日志
    }
}
```

### 5.5 事件驱动架构

```java
/**
 * 领域事件基类
 */
@Data
public abstract class DomainEvent implements Serializable {
    private String eventId = UUID.randomUUID().toString();
    private Long timestamp = System.currentTimeMillis();
    private String eventType = this.getClass().getSimpleName();
    private Long tenantId;
}

/**
 * 任务创建事件
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class TaskCreatedEvent extends DomainEvent {
    private Long taskId;
    private String taskTitle;
    private Long assigneeId;
    private Long projectId;
    private String status;
    private Long creatorId;
}

/**
 * 事件发布器
 */
@Component
public class DomainEventPublisher {

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private MqProducerService mqProducer;

    /**
     * 发布本地事件（Spring 事件机制）
     */
    public void publishLocalEvent(DomainEvent event) {
        eventPublisher.publishEvent(event);
    }

    /**
     * 发布远程事件（通过 MQ）
     */
    public void publishRemoteEvent(DomainEvent event, String topic) {
        mqProducer.sendMessage(topic, "default", event);
    }

    /**
     * 发布事件（本地 + 远程）
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleTransactionalEvent(DomainEvent event) {
        // 事务提交后发布远程事件
        publishRemoteEvent(event, getTopicForEvent(event));
    }
}

/**
 * 本地事件监听器
 */
@Component
@Slf4j
public class TaskCreatedEventListener {

    @Autowired
    private DomainEventPublisher eventPublisher;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleTaskCreated(TaskCreatedEvent event) {
        log.info("处理任务创建事件：{}", event);

        // 1. 发送通知给分配者
        notifyAssignee(event);

        // 2. 更新相关统计
        updateStatistics(event);

        // 3. 触发心跳调度检查
        triggerHeartbeatCheck(event);
    }
}
```

---

## 六、高并发设计

### 6.1 数据库连接池优化

```yaml
# HikariCP 配置
spring:
  datasource:
    hikari:
      minimum-idle: 10           # 最小空闲连接
      maximum-pool-size: 50      # 最大连接池大小
      auto-commit: true          # 自动提交
      idle-timeout: 600000       # 空闲超时 10 分钟
      pool-name: JiGongOpcHikariCP
      max-lifetime: 1800000      # 连接最大生命周期 30 分钟
      connection-timeout: 30000  # 连接超时 30 秒
      leak-detection-threshold: 60000  # 连接泄漏检测 60 秒
```

### 6.2 线程池配置

```java
@Configuration
@EnableAsync
public class ThreadPoolConfig {

    /**
     * 核心业务线程池
     */
    @Bean(name = "businessExecutor")
    public Executor businessExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(20);              // 核心线程数
        executor.setMaxPoolSize(50);               // 最大线程数
        executor.setQueueCapacity(200);            // 队列容量
        executor.setThreadNamePrefix("biz-thread-");
        executor.setKeepAliveSeconds(60);          // 空闲线程存活时间
        executor.setRejectedExecutionHandler(
            new ThreadPoolExecutor.CallerRunsPolicy() // 拒绝策略：调用者运行
        );
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * IO 密集型线程池
     */
    @Bean(name = "ioExecutor")
    public Executor ioExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(40);
        executor.setMaxPoolSize(100);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("io-thread-");
        executor.setKeepAliveSeconds(120);
        executor.setRejectedExecutionHandler(
            new ThreadPoolExecutor.CallerRunsPolicy()
        );
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * 定时任务线程池
     */
    @Bean(name = "scheduledExecutor")
    public Executor scheduledExecutor() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);
        scheduler.setThreadNamePrefix("scheduled-thread-");
        scheduler.setRemoveOnCancelPolicy(true);
        scheduler.setErrorHandler(t -> log.error("定时任务执行异常", t));
        return scheduler;
    }
}
```

### 6.3 异步编程

```java
@Service
@Slf4j
public class AsyncService {

    @Autowired
    @Qualifier("businessExecutor")
    private Executor businessExecutor;

    @Autowired
    @Qualifier("ioExecutor")
    private Executor ioExecutor;

    /**
     * @Async 异步方法
     */
    @Async("businessExecutor")
    public CompletableFuture<Void> asyncProcess(Long taskId) {
        log.info("开始异步处理任务：{}", taskId);
        // 业务逻辑
        return CompletableFuture.completedFuture(null);
    }

    /**
     * 并行编排
     */
    @Async("ioExecutor")
    public CompletableFuture<List<Result>> parallelProcess(List<Long> ids) {
        List<CompletableFuture<Result>> futures = ids.stream()
            .map(id -> CompletableFuture.supplyAsync(
                () -> processSingle(id), ioExecutor))
            .collect(Collectors.toList());

        return CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0]))
            .thenApply(v -> futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList()));
    }

    /**
     * 串行编排
     */
    @Async("businessExecutor")
    public CompletableFuture<Result> serialProcess(Long id) {
        return CompletableFuture.supplyAsync(() -> fetchData(id), ioExecutor)
            .thenApplyAsync(data -> processData(data), businessExecutor)
            .thenApplyAsync(result -> saveResult(result), businessExecutor);
    }
}
```

### 6.4 批量处理优化

```java
@Service
public class BatchService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 批量插入（使用事务 + 批量 SQL）
     */
    @Transactional(rollbackFor = Exception.class)
    public void batchInsert(List<Task> tasks) {
        String sql = "INSERT INTO t_task (title, status, assignee_id) VALUES (?, ?, ?)";

        List<Object[]> batchArgs = tasks.stream()
            .map(task -> new Object[]{
                task.getTitle(),
                task.getStatus(),
                task.getAssigneeId()
            })
            .collect(Collectors.toList());

        jdbcTemplate.batchUpdate(sql, batchArgs);
    }

    /**
     * 批量查询优化（分页分批）
     */
    public List<Task> batchQuery(List<Long> ids) {
        int batchSize = 500;
        List<List<Long>> partitions = Lists.partition(ids, batchSize);

        return partitions.stream()
            .map(partition -> {
                String sql = "SELECT * FROM t_task WHERE id IN (" +
                    partition.stream().map(id -> "?").collect(Collectors.joining(",")) + ")";
                return jdbcTemplate.query(sql,
                    rs -> {
                        List<Task> tasks = new ArrayList<>();
                        while (rs.next()) {
                            tasks.add(mapResultSetToTask(rs));
                        }
                        return tasks;
                    },
                    partition.toArray());
            })
            .flatMap(List::stream)
            .collect(Collectors.toList());
    }
}
```

### 6.5 高并发场景设计

#### 6.5.1 心跳高并发场景

```java
@Service
public class HeartbeatService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @Autowired
    private MqProducerService mqProducer;

    /**
     * 心跳上报（限流 + 批量处理）
     */
    @RateLimiter(value = 10000, key = "#agentId")  // 单 Agent 限流
    public void heartbeat(Long agentId, HeartbeatRequest request) {
        String key = "heartbeat:" + agentId;

        // 1. 更新 Redis 中的心跳时间（高性能）
        redisTemplate.opsForValue().set(key,
            JSON.toJSONString(request),
            60,
            TimeUnit.SECONDS
        );

        // 2. 异步发送心跳事件到 MQ（削峰填谷）
        HeartbeatEvent event = new HeartbeatEvent();
        event.setAgentId(agentId);
        event.setTimestamp(System.currentTimeMillis());
        event.setStatus(request.getStatus());

        mqProducer.sendAsyncMessage(
            MqTopics.AGENT_HEARTBEAT,
            "default",
            event,
            new SendCallback() {
                @Override
                public void onSuccess(SendResult sendResult) {
                    log.info("心跳事件发送成功");
                }

                @Override
                public void onException(Throwable e) {
                    log.error("心跳事件发送失败", e);
                }
            }
        );
    }

    /**
     * 心跳持久化（批量消费 MQ 消息后批量写入）
     */
    @RocketMQMessageListener(
        topic = MqTopics.AGENT_HEARTBEAT,
        consumerGroup = "jgo-heartbeat-persist-group"
    )
    public class HeartbeatPersistConsumer implements RocketMQListener<List<HeartbeatEvent>> {

        @Override
        @Transactional(rollbackFor = Exception.class)
        public void onMessage(List<HeartbeatEvent> events) {
            // 批量插入心跳记录
            batchInsertHeartbeatRecords(events);
        }
    }
}
```

#### 6.5.2 任务原子检出（分布式锁）

```java
@Service
public class TaskCheckoutService {

    @Autowired
    private DistributedLockService lockService;

    @Autowired
    private TaskMapper taskMapper;

    /**
     * 原子检出任务
     * @return 检出结果：SUCCESS/ALREADY_CHECKED_OUT/FAILED
     */
    public CheckoutResult checkout(Long taskId, Long agentId, String runId) {
        String lockKey = "task:checkout:" + taskId;

        try {
            return lockService.executeWithLock(lockKey, 5, () -> {
                // 1. 查询当前任务状态
                Task task = taskMapper.selectById(taskId);

                if (task == null) {
                    return CheckoutResult.notFound();
                }

                if ("checked_out".equals(task.getCheckoutStatus())) {
                    return CheckoutResult.alreadyCheckedOut(task.getCheckoutAgentId());
                }

                if ("in_progress".equals(task.getStatus())) {
                    return CheckoutResult.alreadyInProgress(task.getCheckoutAgentId());
                }

                // 2. 使用乐观锁更新
                int updated = taskMapper.updateCheckoutStatus(
                    taskId,
                    "checked_out",
                    agentId,
                    runId,
                    Instant.now(),
                    task.getUpdatedAt()  // 乐观锁版本号
                );

                if (updated > 0) {
                    // 3. 发送任务检出事件
                    eventPublisher.publishTaskCheckoutEvent(taskId, agentId, runId);
                    return CheckoutResult.success();
                } else {
                    return CheckoutResult.failed("更新失败，任务可能已被检出");
                }
            });
        } catch (RuntimeException e) {
            log.error("任务检出失败：taskId={}, agentId={}", taskId, agentId, e);
            return CheckoutResult.error(e.getMessage());
        }
    }
}
```

---

## 七、服务间通信

### 7.1 Feign 远程调用

```java
/**
 * Agent 服务 Feign 客户端
 */
@FeignClient(
    name = "jigongopc-agent",
    fallback = AgentClientFallback.class
)
public interface AgentClient {

    @GetMapping("/api/agent/{id}")
    Result<AgentDTO> getAgentById(@PathVariable("id") Long id);

    @GetMapping("/api/agent/status/{id}")
    Result<AgentStatusDTO> getAgentStatus(@PathVariable("id") Long id);

    @PostMapping("/api/agent/{id}/invoke")
    Result<Void> invokeAgent(@PathVariable("id") Long id,
                              @RequestBody InvokeRequest request);
}

/**
 * Feign 降级处理
 */
@Component
@Slf4j
public class AgentClientFallback implements AgentClient {

    @Override
    public Result<AgentDTO> getAgentById(Long id) {
        log.error("获取 Agent 失败，触发降级：id={}", id);
        return Result.fail("服务暂时不可用");
    }

    @Override
    public Result<AgentStatusDTO> getAgentStatus(Long id) {
        log.error("获取 Agent 状态失败，触发降级：id={}", id);
        // 从缓存返回
        return Result.data(getAgentStatusFromCache(id));
    }

    @Override
    public Result<Void> invokeAgent(Long id, InvokeRequest request) {
        log.error("调用 Agent 失败，触发降级：id={}", id);
        return Result.fail("服务暂时不可用");
    }
}
```

### 7.2 Feign 配置优化

```yaml
# Feign 配置
feign:
  client:
    config:
      default:
        connectTimeout: 5000   # 连接超时 5 秒
        readTimeout: 30000     # 读取超时 30 秒
        loggerLevel: FULL      # 日志级别
  compression:
    request:
      enabled: true            # 请求压缩
    response:
      enabled: true            # 响应压缩
  httpclient:
    hc:
      enabled: true
      max-connections: 200     # 最大连接数
      max-connections-per-route: 50  # 每路由最大连接数

# Hystrix/Sentinel 配置
feign:
  sentinel:
    enabled: true
```

---

## 八、可观测性

### 8.1 全链路追踪

```yaml
# SkyWalking 配置
skywalking:
  agent:
    service_name: jigongopc-company
    namespace: JiGongOpc
    collector:
      backend_service: ${SKYWalking_COLLECTOR:localhost:11800}
  logging:
    level: DEBUG
```

### 8.2 日志规范

```java
/**
 * 日志使用规范
 */
@Service
@Slf4j
public class LoggingExampleService {

    /**
     * 日志级别使用：
     * ERROR - 系统错误、异常
     * WARN  - 可恢复的异常、降级处理
     * INFO  - 关键业务节点、重要状态变更
     * DEBUG - 调试信息、请求参数
     * TRACE - 详细追踪信息
     */

    public void processTask(Long taskId, TaskRequest request) {
        // 使用占位符，避免字符串拼接
        log.debug("开始处理任务：taskId={}, request={}", taskId,
            JSON.toJSONString(request));

        try {
            // 业务逻辑
            log.info("任务处理成功：taskId={}", taskId);
        } catch (BusinessException e) {
            // 业务异常，记录 WARN
            log.warn("任务处理业务异常：taskId={}, message={}",
                taskId, e.getMessage(), e);
        } catch (Exception e) {
            // 系统异常，记录 ERROR
            log.error("任务处理系统异常：taskId={}", taskId, e);
            throw e;
        }
    }
}
```

### 8.3 日志收集配置

```xml
<!-- Logback 配置 -->
<configuration>
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
        <encoder class="ch.qos.logback.classic.encoder.PatternLayoutEncoder">
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{50} - %msg%n</pattern>
        </encoder>
    </appender>

    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/jigongopc-company.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.TimeBasedRollingPolicy">
            <fileNamePattern>logs/jigongopc-company.%d{yyyy-MM-dd}.log</fileNamePattern>
            <maxHistory>30</maxHistory>
        </rollingPolicy>
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{50} - %msg%n</pattern>
        </encoder>
    </appender>

    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="FILE"/>
    </root>
</configuration>
```

---

## 九、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
