# SPEC-103 性能规范 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

## 一、性能指标

### 1.1 响应时间

#### 1.1.1 API 接口

| 接口类型 | 目标响应时间 | P95 | P99 |
|----------|-------------|-----|-----|
| 简单查询 | < 100ms | 200ms | 500ms |
| 分页列表 | < 200ms | 300ms | 800ms |
| 创建/更新 | < 300ms | 500ms | 1000ms |
| 复杂统计 | < 500ms | 800ms | 1500ms |
| 批量操作 | < 1000ms | 1500ms | 3000ms |

#### 1.1.2 前端页面

| 页面类型 | 首屏加载 | 可交互时间 | 完全加载 |
|----------|---------|-----------|---------|
| 列表页 | < 1s | < 2s | < 3s |
| 详情页 | < 1s | < 1.5s | < 2.5s |
| 表单页 | < 1s | < 1.5s | < 2.5s |
| Dashboard | < 1.5s | < 3s | < 5s |

### 1.2 并发能力

| 场景 | 并发用户数 | 目标成功率 | 响应时间 |
|------|-----------|-----------|---------|
| 日常查询 | 500 | > 99.9% | < 500ms |
| 批量创建 | 100 | > 99% | < 1s |
| 高峰时段 | 1000 | > 99% | < 1s |

### 1.3 数据量支持

| 指标 | 目标值 |
|------|--------|
| 单表数据量 | 100 万 + |
| 列表分页 | 1000 条响应 < 500ms |
| 搜索功能 | 1000 条响应 < 300ms |
| 系统容量 | 1000+ 公司数据量 |

---

## 二、后端优化

### 2.1 数据库优化

#### 2.1.1 索引策略

- 主键索引：默认创建
- 唯一索引：业务唯一字段
- 查询索引：WHERE/ORDER BY 字段
- 联合索引：多字段查询场景

#### 2.1.2 SQL 优化

- 避免 SELECT *
- 避免 N+1 查询
- 使用批量操作
- 大表分页优化

#### 2.1.3 连接池配置

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 10
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
```

### 2.2 缓存优化

#### 2.2.1 缓存策略

- 热点数据：Redis 缓存
- 字典数据：本地缓存
- 会话数据：Redis 分布式会话
- 统计结果：定时预计算

#### 2.2.2 缓存配置

```yaml
spring:
  redis:
    cluster:
      nodes:
        - redis-node-1:6379
        - redis-node-2:6379
        - redis-node-3:6379
    lettuce:
      pool:
        max-active: 50
        max-idle: 20
        min-idle: 10
```

### 2.3 异步处理

#### 2.3.1 异步场景

- 发送邮件/短信
- 文件上传/下载
- 批量数据处理
- 第三方 API 调用

#### 2.3.2 线程池配置

```java
@Bean
public ThreadPoolTaskExecutor taskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(10);
    executor.setMaxPoolSize(50);
    executor.setQueueCapacity(200);
    executor.setThreadNamePrefix("async-");
    executor.initialize();
    return executor;
}
```

---

## 三、前端优化

### 3.1 加载优化

#### 3.1.1 代码分割

- 路由懒加载
- 组件异步加载
- 第三方库拆分

#### 3.1.2 资源优化

- Gzip 压缩
- 图片懒加载
- CDN 加速
- Tree Shaking

### 3.2 渲染优化

#### 3.2.1 虚拟滚动

- 大列表使用虚拟滚动
- 分页加载数据
- 避免一次性渲染大量 DOM

#### 3.2.2 防抖节流

- 搜索输入：防抖 300ms
- 按钮点击：节流 500ms
- 窗口 resize：防抖 200ms

### 3.3 缓存策略

- API 响应：Axios 拦截器缓存
- 静态资源：浏览器缓存
- 字典数据：Vuex 持久化

---

## 四、性能测试

### 4.1 测试工具

| 工具 | 用途 |
|------|------|
| JMeter | 接口压测 |
| k6 | 负载测试 |
| Lighthouse | 前端性能 |
| Prometheus | 监控告警 |

### 4.2 测试场景

#### 4.2.1 基准测试

- 单接口响应时间
- 数据库查询性能
- 缓存命中率

#### 4.2.2 负载测试

- 逐步增加并发用户
- 找到系统瓶颈
- 确定最大容量

#### 4.2.3 压力测试

- 超负荷运行
- 长时间稳定性
- 故障恢复能力

---

## 五、监控告警

### 5.1 监控指标

| 指标 | 阈值 | 告警级别 |
|------|------|---------|
| API 响应时间 P95 | > 1s | Warning |
| API 响应时间 P95 | > 3s | Error |
| 错误率 | > 1% | Warning |
| 错误率 | > 5% | Error |
| CPU 使用率 | > 70% | Warning |
| CPU 使用率 | > 90% | Error |
| 内存使用率 | > 70% | Warning |
| 内存使用率 | > 90% | Error |

### 5.2 日志规范

```java
// 正确：结构化日志
log.info("Company created: companyId={}, userId={}", companyId, userId);

// 错误：避免敏感信息
log.info("User login: username={}", username); // 可能泄露隐私
```

---

## 六、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
