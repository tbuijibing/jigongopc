# SPEC-109 时区管理规范 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

## 一、时区支持原则

### 1.1 核心原则

1. **UTC 存储** - 所有时间数据在数据库和 API 中统一使用 UTC 时区
2. **本地展示** - 前端根据用户时区配置自动转换为本地时间
3. **全局支持** - 支持全球所有主要时区（IANA 时区数据库）
4. **无缝转换** - 时区转换对用户透明，无需手动计算

### 1.2 适用范围

| 层级 | 适用范围 |
|------|----------|
| 后端 | 数据库存储、API 返回、定时任务 |
| 前端 | 时间展示、时间选择器、定时设置 |
| 移动端 | 同前端，跟随系统时区或用户配置 |
| 桌面端 | 同前端，支持多时区同时显示 |

---

## 二、后端时区规范

### 2.1 数据库时区设计

#### 2.1.1 时间字段类型

```sql
-- PostgreSQL 时间字段类型
CREATE TABLE t_company (
    id              BIGINT PRIMARY KEY,
    name            VARCHAR(100),

    -- 时间字段使用 TIMESTAMPTZ（带时区的时间戳）
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    -- 业务时间字段
    budget_start_date   DATE,          -- 日期类型（无时区）
    budget_end_date     DATE,
    last_heartbeat_at   TIMESTAMPTZ    -- 精确时间戳
);
```

**字段类型选择**：
- `TIMESTAMPTZ`：需要精确到秒/毫秒的时间点（创建时间、更新时间、心跳时间等）
- `DATE`：只需要日期精度（生日、计划日期等）
- `TIME`：一天中的时间（营业时间等）
- `INTERVAL`：时间段/持续时间（超时时间、宽限期等）

#### 2.1.2 数据库时区配置

```sql
-- 数据库服务器时区设置为 UTC
ALTER DATABASE jigongopc SET timezone = 'UTC';

-- 会话级别设置（JDBC 连接时）
SET timezone = 'UTC';
```

### 2.2 Java 时间处理

#### 2.2.1 实体类时间字段

```java
@Data
@TableName("t_company")
public class Company {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String name;

    // 使用 Instant 存储 UTC 时间戳
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", timezone = "UTC")
    private Instant createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", timezone = "UTC")
    private Instant updatedAt;

    // 使用 LocalDate 存储日期（无时区）
    private LocalDate budgetStartDate;

    // 使用 Duration 存储时间段
    private Duration sessionTimeout;
}
```

**类型映射**：
| Java 类型 | 数据库类型 | 说明 |
|-----------|------------|------|
| `Instant` | `TIMESTAMPTZ` | UTC 时间戳 |
| `LocalDate` | `DATE` | 本地日期 |
| `LocalTime` | `TIME` | 本地时间 |
| `LocalDateTime` | `TIMESTAMP` | 本地日期时间（慎用） |
| `ZonedDateTime` | `TIMESTAMPTZ` | 带时区的日期时间 |
| `Duration` | `INTERVAL` | 时间段 |

#### 2.2.2 时区工具类

```java
package org.springblade.jigongopc.common.util;

import lombok.experimental.UtilityClass;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 时区工具类
 */
@UtilityClass
public class TimeZoneUtil {

    // 常用时区缓存
    private static final Map<String, ZoneId> ZONE_ID_CACHE = new ConcurrentHashMap<>();

    /**
     * 获取时区 ID
     */
    public ZoneId getZoneId(String timeZoneId) {
        return ZONE_ID_CACHE.computeIfAbsent(timeZoneId, ZoneId::of);
    }

    /**
     * 获取用户默认时区（从配置或上下文）
     */
    public ZoneId getUserZoneId() {
        // 从用户配置/上下文获取时区，默认为 UTC
        String timeZoneId = UserContextHolder.getTimeZone();
        return timeZoneId != null ? getZoneId(timeZoneId) : ZoneId.of("UTC");
    }

    /**
     * Instant 转换为用户本地时间
     */
    public ZonedDateTime toUserTime(Instant instant) {
        return instant != null ? instant.atZone(getUserZoneId()) : null;
    }

    /**
     * Instant 转换为指定时区时间
     */
    public ZonedDateTime toZoneTime(Instant instant, String timeZoneId) {
        return instant != null ? instant.atZone(getZoneId(timeZoneId)) : null;
    }

    /**
     * 用户本地时间转换为 Instant（UTC）
     */
    public Instant toUtc(ZonedDateTime zonedDateTime) {
        return zonedDateTime != null ? zonedDateTime.toInstant() : null;
    }

    /**
     * 格式化时间为用户本地时间字符串
     */
    public String formatUserTime(Instant instant, String pattern) {
        if (instant == null) return null;
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern);
        return toUserTime(instant).format(formatter);
    }

    /**
     * 格式化 UTC 时间字符串
     */
    public String formatUtc(Instant instant) {
        if (instant == null) return null;
        return instant.toString(); // ISO 8601 格式
    }

    /**
     * 解析用户本地时间字符串为 Instant
     */
    public Instant parseUserTime(String timeString, String pattern) {
        if (timeString == null) return null;
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern);
        LocalDateTime localDateTime = LocalDateTime.parse(timeString, formatter);
        return localDateTime.atZone(getUserZoneId()).toInstant();
    }

    /**
     * 解析 ISO 8601 时间字符串为 Instant
     */
    public Instant parseUtc(String isoString) {
        if (isoString == null) return null;
        return Instant.parse(isoString);
    }

    /**
     * 获取所有支持的时区列表
     */
    public Map<String, String> getSupportedTimeZones() {
        Map<String, String> zones = new ConcurrentHashMap<>();
        ZoneId.getAvailableZoneIds().stream()
            .sorted()
            .forEach(id -> {
                ZoneId zoneId = ZoneId.of(id);
                String offset = ZoneId.of(id).getRules().getStandardOffset(Instant.now()).toString();
                zones.put(id, String.format("(%s) %s", offset, id));
            });
        return zones;
    }

    /**
     * 获取常用时区列表（按地区分组）
     */
    public Map<String, Map<String, String>> getCommonTimeZones() {
        Map<String, Map<String, String>> result = new ConcurrentHashMap<>();

        // 亚洲时区
        Map<String, String> asia = new ConcurrentHashMap<>();
        asia.put("Asia/Shanghai", "(UTC+8) 中国标准时间");
        asia.put("Asia/Tokyo", "(UTC+9) 日本标准时间");
        asia.put("Asia/Seoul", "(UTC+9) 韩国标准时间");
        asia.put("Asia/Singapore", "(UTC+8) 新加坡标准时间");
        asia.put("Asia/Bangkok", "(UTC+7) 泰国标准时间");
        asia.put("Asia/Jakarta", "(UTC+7) 印尼标准时间");
        asia.put("Asia/Manila", "(UTC+8) 菲律宾标准时间");
        asia.put("Asia/Kuala_Lumpur", "(UTC+8) 马来西亚标准时间");
        asia.put("Asia/Ho_Chi_Minh", "(UTC+7) 越南标准时间");
        asia.put("Asia/Mumbai", "(UTC+5:30) 印度标准时间");
        asia.put("Asia/Dubai", "(UTC+4) 阿联酋标准时间");
        result.put("Asia", asia);

        // 欧洲时区
        Map<String, String> europe = new ConcurrentHashMap<>();
        europe.put("Europe/London", "(UTC+0) 英国标准时间");
        europe.put("Europe/Paris", "(UTC+1) 中欧标准时间");
        europe.put("Europe/Berlin", "(UTC+1) 德国标准时间");
        europe.put("Europe/Rome", "(UTC+1) 意大利标准时间");
        europe.put("Europe/Madrid", "(UTC+1) 西班牙标准时间");
        europe.put("Europe/Amsterdam", "(UTC+1) 荷兰标准时间");
        europe.put("Europe/Brussels", "(UTC+1) 比利时标准时间");
        europe.put("Europe/Stockholm", "(UTC+1) 瑞典标准时间");
        europe.put("Europe/Moscow", "(UTC+3) 莫斯科标准时间");
        result.put("Europe", europe);

        // 美洲时区
        Map<String, String> america = new ConcurrentHashMap<>();
        america.put("America/New_York", "(UTC-5) 美国东部时间");
        america.put("America/Chicago", "(UTC-6) 美国中部时间");
        america.put("America/Denver", "(UTC-7) 美国山地时间");
        america.put("America/Los_Angeles", "(UTC-8) 美国太平洋时间");
        america.put("America/Sao_Paulo", "(UTC-3) 巴西利亚时间");
        america.put("America/Mexico_City", "(UTC-6) 墨西哥城时间");
        america.put("America/Toronto", "(UTC-5) 加拿大东部时间");
        america.put("America/Vancouver", "(UTC-8) 加拿大太平洋时间");
        result.put("America", america);

        // 大洋洲时区
        Map<String, String> pacific = new ConcurrentHashMap<>();
        pacific.put("Australia/Sydney", "(UTC+10) 澳大利亚东部时间");
        pacific.put("Australia/Melbourne", "(UTC+10) 澳大利亚东部时间");
        pacific.put("Australia/Perth", "(UTC+8) 澳大利亚西部时间");
        pacific.put("Pacific/Auckland", "(UTC+12) 新西兰标准时间");
        pacific.put("Pacific/Fiji", "(UTC+12) 斐济时间");
        pacific.put("Pacific/Honolulu", "(UTC-10) 夏威夷时间");
        result.put("Pacific", pacific);

        // 非洲时区
        Map<String, String> africa = new ConcurrentHashMap<>();
        africa.put("Africa/Cairo", "(UTC+2) 埃及标准时间");
        africa.put("Africa/Johannesburg", "(UTC+2) 南非标准时间");
        africa.put("Africa/Lagos", "(UTC+1) 尼日利亚时间");
        africa.put("Africa/Nairobi", "(UTC+3) 东非时间");
        result.put("Africa", africa);

        return result;
    }
}
```

#### 2.2.3 MyBatis Plus 时间处理

```java
@Configuration
public class MybatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();

        // 自动填充处理器（UTC 时间）
        interceptor.addInnerInterceptor(new MetaObjectHandlerInterceptor());

        return interceptor;
    }

    /**
     * 自动填充处理器
     */
    public static class MetaObjectHandlerInterceptor implements MetaObjectHandler {

        @Override
        public void insertFill(MetaObject metaObject) {
            // 创建时间自动填充为当前 UTC 时间
            this.strictInsertFill(metaObject, "createdAt", Instant.class, Instant.now());
            this.strictInsertFill(metaObject, "updatedAt", Instant.class, Instant.now());
        }

        @Override
        public void updateFill(MetaObject metaObject) {
            // 更新时间自动填充为当前 UTC 时间
            this.strictUpdateFill(metaObject, "updatedAt", Instant.class, Instant.now());
        }
    }
}
```

### 2.3 API 时区规范

#### 2.3.1 统一时间格式

```java
@Configuration
public class JacksonConfig {

    @Bean
    public Module javaTimeModule() {
        JavaTimeModule module = new JavaTimeModule();

        // 序列化：Instant 转为 ISO 8601 格式（UTC）
        module.addSerializer(Instant.class, new InstantSerializer());

        // 反序列化：ISO 8601 格式转为 Instant
        module.addDeserializer(Instant.class, new InstantDeserializer<>(
            Instant.class,
            DateTimeFormatter.ISO_INSTANT,
            Instant::from,
            null,
            null,
            null,
            true
        ));

        return module;
    }

    /**
     * Instant 序列化器 - 输出 ISO 8601 格式
     */
    public static class InstantSerializer extends JsonSerializer<Instant> {
        @Override
        public void serialize(Instant value, JsonGenerator gen, SerializerProvider serializers)
                throws IOException {
            gen.writeString(value.toString()); // ISO 8601 格式：2026-03-14T10:00:00Z
        }
    }
}
```

#### 2.3.2 API 返回格式

```json
{
  "id": 123,
  "name": "示例公司",
  "createdAt": "2026-03-14T10:00:00Z",
  "updatedAt": "2026-03-14T12:30:00Z",
  "budgetStartDate": "2026-03-01",
  "lastHeartbeatAt": "2026-03-14T12:29:55.123Z"
}
```

#### 2.3.3 时区转换接口

```java
@RestController
@RequestMapping("/api/timezone")
public class TimeZoneController {

    /**
     * 获取支持的时区列表
     */
    @GetMapping("/list")
    public R<Map<String, Map<String, String>>> getTimeZones() {
        return R.data(TimeZoneUtil.getCommonTimeZones());
    }

    /**
     * 时间转换
     */
    @PostMapping("/convert")
    public R<TimeConvertResponse> convertTime(@RequestBody TimeConvertRequest request) {
        Instant instant = TimeZoneUtil.parseUtc(request.getTime());
        ZonedDateTime targetTime = TimeZoneUtil.toZoneTime(instant, request.getTargetTimeZone());

        TimeConvertResponse response = new TimeConvertResponse();
        response.setSourceTime(request.getTime());
        response.setSourceTimeZone("UTC");
        response.setTargetTime(targetTime.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        response.setTargetTimeZone(request.getTargetTimeZone());
        response.setOffset(targetTime.getOffset().toString());

        return R.data(response);
    }

    @Data
    public static class TimeConvertRequest {
        @NotBlank(message = "时间不能为空")
        private String time; // ISO 8601 格式

        @NotBlank(message = "目标时区不能为空")
        private String targetTimeZone; // IANA 时区 ID
    }

    @Data
    public static class TimeConvertResponse {
        private String sourceTime;
        private String sourceTimeZone;
        private String targetTime;
        private String targetTimeZone;
        private String offset;
    }
}
```

### 2.4 定时任务时区

```java
@Configuration
public class XxlJobConfig {

    @Bean
    public XxlJobSpringExecutor xxlJobExecutor() {
        XxlJobSpringExecutor executor = new XxlJobSpringExecutor();

        // 调度中心时区设置为 UTC
        executor.setTimeZone("UTC");

        return executor;
    }
}

/**
 * 心跳任务 - UTC 时间执行
 */
@Component
public class HeartbeatTask {

    /**
     * 每 30 秒执行一次（UTC 时间）
     */
    @XxlJob("heartbeatJob")
    public void execute() {
        Instant now = Instant.now();
        // 执行心跳逻辑
        log.info("Heartbeat executed at UTC: {}", now);
    }
}
```

---

## 三、前端时区规范

### 3.1 dayjs 时区配置

```typescript
// src/utils/timezone.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isBetween from 'dayjs/plugin/isBetween';

// 扩展插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

// 默认时区（从用户配置获取）
let userTimeZone = 'Asia/Shanghai';

/**
 * 设置用户时区
 */
export function setUserTimeZone(timeZone: string) {
  userTimeZone = timeZone;
  dayjs.tz.setDefault(timeZone);
}

/**
 * 获取用户时区
 */
export function getUserTimeZone(): string {
  return userTimeZone;
}

/**
 * UTC 时间转换为用户本地时间
 */
export function toUserTime(utcString: string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(utcString).tz(userTimeZone).format(format);
}

/**
 * UTC 时间转换为用户本地时间（Dayjs 对象）
 */
export function toUserDayjs(utcString: string): dayjs.Dayjs {
  return dayjs(utcString).tz(userTimeZone);
}

/**
 * 本地时间转换为 UTC
 */
export function toUtc(localString: string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs.tz(localString, userTimeZone).utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
}

/**
 * 转换为指定时区
 */
export function toTimeZone(utcString: string, timeZone: string): string {
  return dayjs(utcString).tz(timeZone).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * 获取时区偏移量
 */
export function getTimeZoneOffset(timeZone: string): string {
  const offset = dayjs().tz(timeZone).utcOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * 格式化相对时间（如：5 分钟前）
 */
export function formatRelative(utcString: string): string {
  return dayjs(utcString).fromNow();
}

/**
 * 格式化日期（无时间）
 */
export function formatDate(utcString: string): string {
  return dayjs(utcString).tz(userTimeZone).format('YYYY-MM-DD');
}

/**
 * 格式化时间（无日期）
 */
export function formatTime(utcString: string): string {
  return dayjs(utcString).tz(userTimeZone).format('HH:mm:ss');
}

/**
 * 判断时间是否在指定范围内
 */
export function isTimeBetween(
  utcString: string,
  start: string,
  end: string
): boolean {
  return dayjs(utcString).tz(userTimeZone).isBetween(
    dayjs.tz(start, userTimeZone),
    dayjs.tz(end, userTimeZone)
  );
}
```

### 3.2 Vue 组件封装

```vue
<!-- src/components/TimeDisplay.vue -->
<template>
  <span :title="utcString">
    <template v-if="type === 'datetime'">
      {{ displayTime }}
    </template>
    <template v-else-if="type === 'date'">
      {{ displayDate }}
    </template>
    <template v-else-if="type === 'time'">
      {{ displayTimeOnly }}
    </template>
    <template v-else-if="type === 'relative'">
      {{ displayRelative }}
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  toUserTime,
  formatDate,
  formatTime,
  formatRelative
} from '@/utils/timezone';

interface Props {
  utcString?: string;
  type?: 'datetime' | 'date' | 'time' | 'relative';
  format?: string;
}

const props = withDefaults(defineProps<Props>(), {
  utcString: '',
  type: 'datetime',
  format: 'YYYY-MM-DD HH:mm:ss'
});

const displayTime = computed(() => {
  if (!props.utcString) return '';
  return toUserTime(props.utcString, props.format);
});

const displayDate = computed(() => {
  if (!props.utcString) return '';
  return formatDate(props.utcString);
});

const displayTimeOnly = computed(() => {
  if (!props.utcString) return '';
  return formatTime(props.utcString);
});

const displayRelative = computed(() => {
  if (!props.utcString) return '';
  return formatRelative(props.utcString);
});
</script>
```

### 3.3 时间选择器组件

```vue
<!-- src/components/TimeZonePicker.vue -->
<template>
  <el-select
    v-model="selectedTimeZone"
    :placeholder="placeholder"
    filterable
    @change="handleTimezoneChange"
  >
    <el-option-group
      v-for="(zones, group) in timeZoneGroups"
      :key="group"
      :label="group"
    >
      <el-option
        v-for="(label, value) in zones"
        :key="value"
        :label="label"
        :value="value"
      />
    </el-option-group>
  </el-select>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { getUserTimeZone } from '@/utils/timezone';

interface Props {
  modelValue?: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '请选择时区'
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'change': [value: string];
}>();

// 时区数据（从后端 API 获取）
const timeZoneGroups = ref({
  'Asia': {
    'Asia/Shanghai': '(UTC+8) 中国标准时间',
    'Asia/Tokyo': '(UTC+9) 日本标准时间',
    'Asia/Seoul': '(UTC+9) 韩国标准时间',
    'Asia/Singapore': '(UTC+8) 新加坡标准时间'
  },
  'Europe': {
    'Europe/London': '(UTC+0) 英国标准时间',
    'Europe/Paris': '(UTC+1) 中欧标准时间',
    'Europe/Berlin': '(UTC+1) 德国标准时间'
  },
  'America': {
    'America/New_York': '(UTC-5) 美国东部时间',
    'America/Los_Angeles': '(UTC-8) 美国太平洋时间'
  },
  'Pacific': {
    'Australia/Sydney': '(UTC+10) 澳大利亚东部时间',
    'Pacific/Auckland': '(UTC+12) 新西兰标准时间'
  }
});

const selectedTimeZone = ref(props.modelValue || getUserTimeZone());

watch(() => props.modelValue, (val) => {
  if (val && val !== selectedTimeZone.value) {
    selectedTimeZone.value = val;
  }
});

function handleTimezoneChange(value: string) {
  emit('update:modelValue', value);
  emit('change', value);
}
</script>
```

### 3.4 全局时区配置

```typescript
// src/config/timezone.ts
import { setUserTimeZone } from '@/utils/timezone';
import { getUserPreference, updateUserPreference } from '@/api/user';

/**
 * 初始化用户时区
 */
export async function initTimeZone() {
  try {
    // 1. 尝试从用户配置获取
    const preference = await getUserPreference();
    const userTimeZone = preference?.timeZone;

    if (userTimeZone) {
      setUserTimeZone(userTimeZone);
      return;
    }

    // 2. 尝试从浏览器获取
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTimeZone) {
      setUserTimeZone(browserTimeZone);
      // 保存到用户配置
      await updateUserPreference({ timeZone: browserTimeZone });
    }

    // 3. 默认使用 UTC
    setUserTimeZone('UTC');
  } catch (error) {
    console.error('Failed to initialize time zone:', error);
    setUserTimeZone('UTC');
  }
}

/**
 * 更新用户时区
 */
export async function updateUserTimeZone(timeZone: string) {
  setUserTimeZone(timeZone);
  await updateUserPreference({ timeZone });
}
```

### 3.5 Avue 表单时间列配置

```typescript
// src/views/jigongopc/company/companyCrud.ts
export const option = {
  column: [
    {
      label: '创建时间',
      prop: 'createdAt',
      type: 'datetime',
      format: 'yyyy-MM-dd HH:mm:ss',
      valueFormat: 'yyyy-MM-ddTHH:mm:ss.SSSZ',
      readonly: true,
      // 显示时区转换后的时间
      displayFormatter: (value: string) => {
        return toUserTime(value, 'YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      label: '更新时间',
      prop: 'updatedAt',
      type: 'datetime',
      format: 'yyyy-MM-dd HH:mm:ss',
      valueFormat: 'yyyy-MM-ddTHH:mm:ss.SSSZ',
      readonly: true,
      displayFormatter: (value: string) => {
        return toUserTime(value, 'YYYY-MM-DD HH:mm:ss');
      }
    },
    {
      label: '预算开始日期',
      prop: 'budgetStartDate',
      type: 'date',
      format: 'yyyy-MM-dd',
      valueFormat: 'yyyy-MM-dd'
    }
  ]
};
```

---

## 四、用户时区配置

### 4.1 用户时区字段

```sql
-- 用户表增加时区字段
ALTER TABLE blade_user
ADD COLUMN time_zone VARCHAR(50) DEFAULT 'Asia/Shanghai'
COMMENT '用户时区：IANA 时区 ID';

-- 用户偏好表
CREATE TABLE t_user_preference (
    id              BIGINT PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    preference_key  VARCHAR(50) NOT NULL,
    preference_value VARCHAR(255) NOT NULL,
    create_time     TIMESTAMPTZ DEFAULT NOW(),
    update_time     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE KEY uk_user_key (user_id, preference_key)
);

-- 时区配置
INSERT INTO t_user_preference (user_id, preference_key, preference_value)
VALUES (1, 'timeZone', 'Asia/Shanghai');
```

### 4.2 时区切换接口

```java
@RestController
@RequestMapping("/api/user/preference")
public class UserPreferenceController {

    @Autowired
    private UserPreferenceService userPreferenceService;

    /**
     * 更新时区配置
     */
    @PutMapping("/timezone")
    public R<Void> updateTimeZone(@RequestBody TimeZoneRequest request) {
        userPreferenceService.updateTimeZone(request.getTimeZone());
        return R.success("操作成功");
    }

    /**
     * 获取时区配置
     */
    @GetMapping("/timezone")
    public R<TimeZoneResponse> getTimeZone() {
        String timeZone = userPreferenceService.getTimeZone();
        TimeZoneResponse response = new TimeZoneResponse();
        response.setTimeZone(timeZone);
        response.setOffset(TimeZoneUtil.getTimeZoneOffset(timeZone));
        return R.data(response);
    }

    @Data
    public static class TimeZoneRequest {
        @NotBlank(message = "时区不能为空")
        private String timeZone;
    }

    @Data
    public static class TimeZoneResponse {
        private String timeZone;
        private String offset;
    }
}
```

---

## 五、多时区支持场景

### 5.1 跨时区协作

```java
@Service
public class MeetingScheduleService {

    /**
     * 创建跨时区会议
     */
    @Transactional
    public Meeting createMeeting(MeetingRequest request) {
        // 1. 解析发起人时区的会议时间
        Instant utcStartTime = TimeZoneUtil.parseUserTime(
            request.getStartTime(),
            request.getOrganizerTimeZone()
        );

        // 2. 存储为 UTC 时间
        Meeting meeting = new Meeting();
        meeting.setStartTimeUtc(utcStartTime);
        meeting.setEndTimeUtc(utcStartTime.plus(request.getDuration()));
        meeting.setOrganizerTimeZone(request.getOrganizerTimeZone());

        // 3. 为每个参与者计算本地时间
        List<MeetingParticipant> participants = request.getParticipantTimeZones()
            .stream()
            .map(tz -> {
                MeetingParticipant p = new MeetingParticipant();
                p.setUserId(tz.getUserId());
                p.setLocalStartTime(TimeZoneUtil.toZoneTime(
                    utcStartTime,
                    tz.getTimeZone()
                ).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
                p.setTimeZone(tz.getTimeZone());
                return p;
            })
            .collect(Collectors.toList());

        meeting.setParticipants(participants);
        meetingMapper.insert(meeting);

        return meeting;
    }
}
```

### 5.2 定时任务时区

```java
/**
 * 定时报表任务 - 按用户时区生成
 */
@Component
public class ReportScheduleTask {

    @XxlJob("dailyReportJob")
    public void executeDailyReport() {
        // 获取所有用户时区
        List<String> timeZones = timeZoneService.getAllUserTimeZones();

        for (String timeZone : timeZones) {
            // 检查该时区当前是否应该执行
            if (shouldExecuteInTimeZone(timeZone)) {
                // 为该时区用户生成报表
                generateReportForTimeZone(timeZone);
            }
        }
    }

    private boolean shouldExecuteInTimeZone(String timeZone) {
        // 在每个时区的早上 8 点执行
        LocalTime now = LocalTime.now(ZoneId.of(timeZone));
        return now.getHour() == 8 && now.getMinute() == 0;
    }
}
```

### 5.3 时间范围筛选

```java
/**
 * 按日期范围查询（考虑时区）
 */
public List<Issue> queryIssuesByDateRange(
    String startDate,
    String endDate,
    String timeZone
) {
    // 将用户选择的日期范围转换为 UTC
    Instant startUtc = TimeZoneUtil.parseUserTime(
        startDate + "T00:00:00",
        "yyyy-MM-dd'T'HH:mm:ss"
    ).atZone(ZoneId.of(timeZone)).toInstant();

    Instant endUtc = TimeZoneUtil.parseUserTime(
        endDate + "T23:59:59",
        "yyyy-MM-dd'T'HH:mm:ss"
    ).atZone(ZoneId.of(timeZone)).toInstant();

    // 查询 UTC 时间范围内的数据
    return issueMapper.selectList(new LambdaQueryWrapper<Issue>()
        .ge(Issue::getCreatedAt, startUtc)
        .le(Issue::getCreatedAt, endUtc)
    );
}
```

---

## 六、时区测试

### 6.1 单元测试

```java
@SpringBootTest
class TimeZoneUtilTest {

    @Test
    void testToUserTime() {
        Instant utc = Instant.parse("2026-03-14T10:00:00Z");

        // 模拟用户时区为 Asia/Shanghai (UTC+8)
        UserContextHolder.setTimeZone("Asia/Shanghai");

        ZonedDateTime userTime = TimeZoneUtil.toUserTime(utc);

        assertEquals(18, userTime.getHour()); // 10:00 UTC = 18:00 CST
        assertEquals("Asia/Shanghai", userTime.getZone().getId());
    }

    @Test
    void testToUtc() {
        ZonedDateTime localTime = ZonedDateTime.of(
            LocalDateTime.of(2026, 3, 14, 18, 0),
            ZoneId.of("Asia/Shanghai")
        );

        Instant utc = TimeZoneUtil.toUtc(localTime);

        assertEquals("2026-03-14T10:00:00Z", utc.toString());
    }

    @Test
    void testTimeConversion() {
        String utcString = "2026-03-14T10:00:00Z";

        // UTC -> Shanghai (UTC+8)
        String shanghaiTime = TimeZoneUtil.toZoneTime(
            Instant.parse(utcString),
            "Asia/Shanghai"
        ).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        assertEquals("2026-03-14T18:00:00", shanghaiTime);

        // UTC -> New York (UTC-5)
        String nyTime = TimeZoneUtil.toZoneTime(
            Instant.parse(utcString),
            "America/New_York"
        ).format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        assertEquals("2026-03-14T05:00:00", nyTime);
    }
}
```

### 6.2 API 测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class TimeZoneControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void testGetTimeZones() throws Exception {
        mockMvc.perform(get("/api/timezone/list"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.Asia").exists())
            .andExpect(jsonPath("$.data.Europe").exists())
            .andExpect(jsonPath("$.data.America").exists());
    }

    @Test
    void testConvertTime() throws Exception {
        String requestBody = """
            {
                "time": "2026-03-14T10:00:00Z",
                "targetTimeZone": "Asia/Shanghai"
            }
            """;

        mockMvc.perform(post("/api/timezone/convert")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.targetTime").value("2026-03-14T18:00:00"))
            .andExpect(jsonPath("$.data.targetTimeZone").value("Asia/Shanghai"))
            .andExpect(jsonPath("$.data.offset").value("+08:00"));
    }
}
```

---

## 七、时区调试与排错

### 7.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 时间差 8 小时 | 未按 UTC 存储 | 检查数据库字段类型是否为 TIMESTAMPTZ |
| 时间显示错误 | 时区配置错误 | 检查用户时区配置是否正确 |
| 定时任务时间不对 | Cron 表达式时区 | 设置 XXL-Job 时区为 UTC |
| 前端时间格式错误 | dayjs 插件未加载 | 确保 timezone 插件已 extend |

### 7.2 调试日志

```java
@Component
@Slf4j
public class TimeZoneDebugService {

    /**
     * 打印时间转换过程
     */
    public void debugTimeConversion(String utcString, String targetTimeZone) {
        Instant instant = Instant.parse(utcString);

        log.info("=== 时区转换调试 ===");
        log.info("原始 UTC 时间：{}", instant);
        log.info("目标时区：{}", targetTimeZone);

        ZoneId zoneId = ZoneId.of(targetTimeZone);
        ZonedDateTime zonedDateTime = instant.atZone(zoneId);

        log.info("转换后时间：{}", zonedDateTime);
        log.info("时区偏移：{}", zonedDateTime.getOffset());
        log.info("是否夏令时：{}", zonedDateTime.getRules().isDaylightSavings(instant));
        log.info("==================");
    }
}
```

---

## 八、支持的时区列表

### 8.1 亚洲时区

| 时区 ID | 偏移量 | 说明 |
|---------|--------|------|
| Asia/Shanghai | UTC+8 | 中国标准时间 |
| Asia/Tokyo | UTC+9 | 日本标准时间 |
| Asia/Seoul | UTC+9 | 韩国标准时间 |
| Asia/Singapore | UTC+8 | 新加坡标准时间 |
| Asia/Hong_Kong | UTC+8 | 香港标准时间 |
| Asia/Taipei | UTC+8 | 台北标准时间 |
| Asia/Bangkok | UTC+7 | 泰国标准时间 |
| Asia/Jakarta | UTC+7 | 印尼标准时间 |
| Asia/Manila | UTC+8 | 菲律宾标准时间 |
| Asia/Kuala_Lumpur | UTC+8 | 马来西亚标准时间 |
| Asia/Ho_Chi_Minh | UTC+7 | 越南标准时间 |
| Asia/Mumbai | UTC+5:30 | 印度标准时间 |
| Asia/Dubai | UTC+4 | 阿联酋标准时间 |
| Asia/Riyadh | UTC+3 | 沙特标准时间 |
| Asia/Jerusalem | UTC+2 | 以色列标准时间 |

### 8.2 欧洲时区

| 时区 ID | 偏移量 | 说明 |
|---------|--------|------|
| Europe/London | UTC+0 | 英国标准时间 |
| Europe/Paris | UTC+1 | 中欧标准时间 |
| Europe/Berlin | UTC+1 | 德国标准时间 |
| Europe/Rome | UTC+1 | 意大利标准时间 |
| Europe/Madrid | UTC+1 | 西班牙标准时间 |
| Europe/Amsterdam | UTC+1 | 荷兰标准时间 |
| Europe/Brussels | UTC+1 | 比利时标准时间 |
| Europe/Stockholm | UTC+1 | 瑞典标准时间 |
| Europe/Moscow | UTC+3 | 莫斯科标准时间 |
| Europe/Athens | UTC+2 | 希腊标准时间 |

### 8.3 美洲时区

| 时区 ID | 偏移量 | 说明 |
|---------|--------|------|
| America/New_York | UTC-5 | 美国东部时间 |
| America/Chicago | UTC-6 | 美国中部时间 |
| America/Denver | UTC-7 | 美国山地时间 |
| America/Los_Angeles | UTC-8 | 美国太平洋时间 |
| America/Sao_Paulo | UTC-3 | 巴西利亚时间 |
| America/Mexico_City | UTC-6 | 墨西哥城时间 |
| America/Toronto | UTC-5 | 加拿大东部时间 |
| America/Vancouver | UTC-8 | 加拿大太平洋时间 |
| America/Argentina/Buenos_Aires | UTC-3 | 阿根廷时间 |

### 8.4 大洋洲时区

| 时区 ID | 偏移量 | 说明 |
|---------|--------|------|
| Australia/Sydney | UTC+10 | 澳大利亚东部时间 |
| Australia/Melbourne | UTC+10 | 澳大利亚东部时间 |
| Australia/Perth | UTC+8 | 澳大利亚西部时间 |
| Pacific/Auckland | UTC+12 | 新西兰标准时间 |
| Pacific/Fiji | UTC+12 | 斐济时间 |
| Pacific/Honolulu | UTC-10 | 夏威夷时间 |

### 8.5 非洲时区

| 时区 ID | 偏移量 | 说明 |
|---------|--------|------|
| Africa/Cairo | UTC+2 | 埃及标准时间 |
| Africa/Johannesburg | UTC+2 | 南非标准时间 |
| Africa/Lagos | UTC+1 | 尼日利亚时间 |
| Africa/Nairobi | UTC+3 | 东非时间 |
| Africa/Casablanca | UTC+1 | 摩洛哥标准时间 |

---

## 九、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
