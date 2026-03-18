# SPEC-108 OpenClaw 客户端集成规范 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

## 一、架构说明

### 1.1 OpenClaw 定位

OpenClaw 是一个 **客户端组件**，不是服务端集成。用户在安装客户端时可以选择直接安装到自己电脑上。

### 1.2 部署模式

```
+-------------------------------------------------------------+
|                     用户电脑/本地环境                        |
|  +----------------+         +----------------+              |
|  |   桌面客户端    |         |   命令行工具    |              |
|  |   (Electron)  |         |   (CLI)        |              |
|  |                |         |                |              |
|  |  +----------+  |         |  +----------+  |              |
|  |  | OpenClaw |  |         |  | OpenClaw |  |              |
|  |  | Gateway  |  |         |  | Adapter  |  |              |
|  |  | Client   |  |         |  |          |  |              |
|  |  +----+-----+  |         |  +----+-----+  |              |
|  +-------|--------+         +-------|--------+              |
|          |                        |                         |
|          +------------+-----------+                         |
|                       |                                     |
|              WebSocket 连接                                  |
|                       |                                     |
+-----------------------+-------------------------------------+
                        |
                        | WebSocket
                        |
                        v
+-------------------------------------------------------------+
|                    JiGongOpc-Java 服务端                     |
|  +----------------+         +----------------+              |
|  |   API 网关      |         |   业务服务     |              |
|  |   (Gateway)   |<--------|   (Service)    |              |
|  +----------------+         +----------------+              |
+-------------------------------------------------------------+
```

### 1.3 集成方式

OpenClaw 以以下形式集成到客户端：

1. **桌面客户端内置** - Electron 应用内置 OpenClaw Gateway Client
2. **命令行工具** - 独立的 CLI 工具，可单独安装
3. **浏览器扩展** - Web 端通过浏览器扩展调用本地 OpenClaw

---

## 二、客户端技术栈

### 2.1 桌面客户端 (Electron)

- electron: ^29.0.0
- ws: ^8.16.0
- jigongopc-openclaw-client: ^1.0.0

### 2.2 OpenClaw Gateway Client 接口

```typescript
interface OpenClawGatewayClient {
  // 连接网关
  connect(config: ConnectConfig): Promise<Connection>;
  
  // 调用 Agent
  invokeAgent(agentId: string, context: AgentContext): Promise<AgentRun>;
  
  // 取消运行
  cancel(runId: string): Promise<void>;
  
  // 订阅事件
  subscribeEvents(runId: string): Observable<AgentEvent>;
}
```

### 2.3 客户端目录结构

```
desktop/electron/
├── src/
│   ├── main/
│   │   ├── main.js              # Electron 主进程
│   │   ├── openclaw/
│   │   │   ├── gateway-client.js # OpenClaw 网关客户端
│   │   │   ├── adapter.js        # 适配器实现
│   │   │   └── session.js        # 会话管理
│   │   └── preload.js            # 预加载脚本
│   ├── renderer/
│   │   ├── App.vue               # 前端界面
│   │   └── ...
│   └── shared/
│       └── types.js              # 类型定义
├── package.json
└── electron-builder.yml
```

---

## 三、WebSocket 协议

### 3.1 连接流程

1. 客户端连接 ws://gateway/endpoint
2. 接收 connect.challenge 挑战
3. 发送 req connect (协议/客户端/认证/设备信息)
4. 发送 req agent 启动 Agent
5. 等待 agent.wait 完成
6. 流式接收 event agent 事件

### 3.2 认证模式

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| authToken | Token 认证 | 桌面客户端 |
| password | 共享密码 | 内部网络 |
| headers | Header Token | 企业集成 |

### 3.3 会话策略

| 策略 | 说明 | 使用场景 |
|------|------|----------|
| issue | 按 Issue 创建会话 | 任务驱动 |
| fixed | 固定会话 Key | 长期运行 |
| run | 每次运行新会话 | 一次性任务 |

---

## 四、适配器实现

### 4.1 适配器接口

```typescript
interface AgentAdapter {
  invoke(agent: Agent, context: InvocationContext): Promise<InvokeResult>;
  status(run: HeartbeatRun): Promise<RunStatus>;
  cancel(run: HeartbeatRun): Promise<void>;
}
```

### 4.2 OpenClaw Gateway 适配器

OpenClaw Gateway 适配器负责：
- 建立 WebSocket 连接
- 发送 Agent 调用请求
- 接收事件流
- 处理取消请求

---

## 五、客户端安装

### 5.1 安装包制作

使用 electron-builder 制作安装包：
- Windows: NSIS、便携版
- macOS: DMG、ZIP
- Linux: AppImage、deb

### 5.2 安装选项

用户安装时可选择：
- [x] 安装 OpenClaw Gateway Client（必需）
- [x] 安装命令行工具（可选）
- [x] 创建桌面快捷方式（可选）
- [x] 开机自启动（可选）

---

## 六、安全配置

### 6.1 Token 存储

使用系统密钥链（keytar）存储敏感信息：
- Windows: Windows Credential Manager
- macOS: Keychain
- Linux: libsecret

### 6.2 通信加密

- WebSocket 使用 WSS（WebSocket Secure）
- TLS 1.3 加密
- Token 不落地存储

### 6.3 设备认证

设备需要注册并获取唯一设备 ID，用于：
- 会话跟踪
- 安全审计
- 设备管理

---

## 七、错误处理

### 7.1 连接错误

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| 50001 | 无法连接网关 | 检查网络，重试 |
| 50002 | 认证失败 | 重新登录 |
| 50003 | 会话超时 | 创建新会话 |
| 50004 | Agent 不可用 | 通知用户 |
| 50005 | 运行被取消 | 清理状态 |

### 7.2 重连策略

- 最大重试次数：3 次
- 退避算法：指数退避（1s, 2s, 4s）
- 连接超时：30 秒

---

## 八、日志与监控

### 8.1 日志配置

- 使用 electron-log
- 日志级别：info（文件）、debug（控制台）
- 最大文件大小：10MB
- 日志轮转：保留最近 7 天

### 8.2 监控指标

| 指标 | 说明 |
|------|------|
| 连接成功率 | WebSocket 连接成功次数/总次数 |
| Agent 调用成功率 | 调用成功次数/总次数 |
| 平均响应时间 | 从调用到完成的时间 |
| 错误分布 | 各类错误的数量统计 |

---

## 九、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
