# SPEC-200 技术开发规范 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0
>
> **说明**：本文档定义 JiGongOpc-Java 项目各端（后端、Web 前端、移动端 H5、桌面端、客户端）的技术开发规范。
>
> **重要**：本系统全面支持国际化，所有用户可见文案必须通过国际化系统获取，禁止在代码中硬编码任何文案。

---

## 一、后端技术开发规范

### 1.1 项目结构规范

```
jigongopc-service/
├── company/                    # 公司服务
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/
│   │   │   │   └── org/
│   │   │   │       └── springblade/
│   │   │   │           └── jigongopc/
│   │   │   │               └── company/
│   │   │   │                   ├── CompanyApplication.java    # 启动类
│   │   │   │                   ├── controller/                 # 控制器层
│   │   │   │                   │   └── CompanyController.java
│   │   │   │                   ├── service/                    # 服务层
│   │   │   │                   │   ├── ICompanyService.java   # 服务接口
│   │   │   │                   │   └── impl/
│   │   │   │                   │       └── CompanyServiceImpl.java
│   │   │   │                   ├── mapper/                     # 数据访问层
│   │   │   │                   │   └── CompanyMapper.java
│   │   │   │                   ├── entity/                     # 实体类
│   │   │   │                   │   ├── Company.java
│   │   │   │                   │   └── CompanyTranslation.java
│   │   │   │                   ├── dto/                        # 数据传输对象
│   │   │   │                   │   ├── CompanyDTO.java
│   │   │   │                   │   └── CompanyRequest.java
│   │   │   │                   ├── vo/                         # 视图对象
│   │   │   │                   │   └── CompanyVO.java
│   │   │   │                   └── config/                     # 配置类
│   │   │   │                       └── CompanyConfig.java
│   │   │   └── resources/
│   │   │       ├── application.yml                            # 配置文件
│   │   │       ├── application-dev.yml                        # 开发环境配置
│   │   │       ├── application-prod.yml                       # 生产环境配置
│   │   │       └── i18n/                                      # 国际化资源
│   │   │           └── messages_zh_CN.properties
│   │   │       └── mapper/
│   │   │           └── company/
│   │   │               └── CompanyMapper.xml                  # MyBatis 映射
│   │   └── test/
│   │       └── java/
│   │           └── org/springblade/jigongopc/company/
│   │               └── controller/
│   │                   └── CompanyControllerTest.java
│   └── pom.xml
```

### 1.2 命名规范

#### 1.2.1 项目命名

- **项目名称**：JiGongOpc-Java（驼峰式）
- **模块前缀**：jigongopc-*（小写，连字符）
- **包名**：org.springblade.jigongopc.*（全小写）

#### 1.2.2 类命名

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 实体类 | 名词，大驼峰 | `Company`, `Agent`, `Issue` |
| DTO | 名词 + DTO，大驼峰 | `CompanyDTO`, `AgentDTO` |
| Request | 名词 + Request，大驼峰 | `CreateCompanyRequest`, `UpdateAgentRequest` |
| Response | 名词 + Response，大驼峰 | `CompanyResponse`, `PageResult` |
| VO | 名词 + VO，大驼峰 | `CompanyVO`, `AgentVO` |
| 服务接口 | I+ 名词 +Service，大驼峰 | `ICompanyService`, `IAgentService` |
| 服务实现 | 服务实现名 +Impl，大驼峰 | `CompanyServiceImpl`, `AgentServiceImpl` |
| 控制器 | 名词 +Controller，大驼峰 | `CompanyController`, `AgentController` |
| Mapper | 名词 +Mapper，大驼峰 | `CompanyMapper`, `AgentMapper` |
| 配置类 | 名词 +Config，大驼峰 | `CompanyConfig`, `RedisConfig` |
| 工具类 | 名词 +Util/Utils，大驼峰 | `DateUtil`, `BeanUtils` |
| 枚举 | 名词，大驼峰 | `CompanyStatus`, `IssuePriority` |
| 常量 | 名词，大驼峰 | `CompanyConstants`, `AppConstants` |

#### 1.2.3 方法命名

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 查询单个 | get/find + 实体 | `getById`, `findByName` |
| 查询列表 | list + 实体 | `listCompanies`, `listByStatus` |
| 分页查询 | page + 实体 | `pageCompanies`, `pageByCondition` |
| 创建 | create/save + 实体 | `createCompany`, `saveAgent` |
| 更新 | update + 实体 | `updateCompany`, `updateAgent` |
| 删除 | delete/remove + 实体 | `deleteCompany`, `removeAgent` |
| 存在检查 | exists + 条件 | `existsByName`, `existsById` |
| 计数 | count + 条件 | `countByStatus`, `countTotal` |

#### 1.2.4 变量命名

```java
// 实体对象 - 小驼峰
Company company = new Company();
Agent agent = agentService.getById(agentId);

// 集合 - 复数形式
List<Company> companies = companyService.listAll();
List<Agent> agents = agentService.listByCompany(companyId);

// Map - 描述性命名
Map<Long, Company> companyMap = companies.stream()
    .collect(Collectors.toMap(Company::getId, Function.identity()));

// 布尔值 - is/has/can 前缀
boolean isActive = company.getStatus().equals("active");
boolean hasPermission = securityService.hasPermission(user, "company:edit");

// 常量 - 全大写，下划线分隔
public static final String DEFAULT_LANGUAGE = "zh-CN";
public static final int DEFAULT_PAGE_SIZE = 10;
```

### 1.3 代码规范

#### 1.3.1 控制器层规范

```java
@RestController
@RequestMapping("/api/company")
@Api(value = "公司管理", tags = {"公司管理"})
public class CompanyController {

    private final ICompanyService companyService;

    // 构造器注入（推荐）
    @Autowired
    public CompanyController(ICompanyService companyService) {
        this.companyService = companyService;
    }

    /**
     * 分页查询公司列表
     *
     * @param page 分页参数
     * @param request 查询条件
     * @return 公司列表
     */
    @GetMapping("/page")
    @Operation(summary = "分页查询公司列表")
    @DataScope(alias = "c")
    public R<Page<CompanyVO>> page(
        @ParameterObject Query page,
        @ParameterObject CompanyRequest request
    ) {
        Page<CompanyVO> result = companyService.pageCompanies(page, request);
        return R.data(result);
    }

    /**
     * 根据 ID 查询公司详情
     *
     * @param id 公司 ID
     * @return 公司详情
     */
    @GetMapping("/{id}")
    @Operation(summary = "查询公司详情")
    public R<CompanyVO> getById(@PathVariable Long id) {
        CompanyVO company = companyService.getCompanyById(id);
        return R.data(company);
    }

    /**
     * 创建公司
     *
     * @param request 创建请求
     * @return 是否成功
     */
    @PostMapping
    @Operation(summary = "创建公司")
    @PreAuth(RoleConstant.HAS_ROLE_ADMIN)
    public R<Boolean> create(@Validated @RequestBody CreateCompanyRequest request) {
        return R.data(companyService.createCompany(request));
    }

    /**
     * 更新公司
     *
     * @param id 公司 ID
     * @param request 更新请求
     * @return 是否成功
     */
    @PutMapping("/{id}")
    @Operation(summary = "更新公司")
    @PreAuth(RoleConstant.HAS_ROLE_ADMIN)
    public R<Boolean> update(
        @PathVariable Long id,
        @Validated @RequestBody UpdateCompanyRequest request
    ) {
        return R.data(companyService.updateCompany(id, request));
    }

    /**
     * 删除公司
     *
     * @param ids 公司 ID 数组
     * @return 是否成功
     */
    @DeleteMapping
    @Operation(summary = "删除公司")
    @PreAuth(RoleConstant.HAS_ROLE_ADMIN)
    public R<Boolean> delete(@RequestParam Long[] ids) {
        return R.data(companyService.deleteCompanies(ids));
    }
}
```

**要点**：
- 使用 `@RestController` 定义控制器
- 使用 `@RequestMapping` 定义基础路径
- 使用 `@Operation` 描述接口用途（使用国际化消息码）
- 使用 `@ParameterObject` 简化参数绑定
- 使用 `@Validated` 进行参数校验
- 使用 `@PreAuth` 进行权限控制
- 使用 `@DataScope` 进行数据权限控制
- 统一返回 `R<T>` 格式
- **所有错误消息必须使用国际化消息码**

#### 1.3.2 服务层规范

```java
/**
 * 公司服务接口
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
public interface ICompanyService extends BaseService<Company> {

    /**
     * 分页查询公司
     *
     * @param page 分页参数
     * @param request 查询条件
     * @return 分页结果
     */
    Page<CompanyVO> pageCompanies(IPage page, CompanyRequest request);

    /**
     * 根据 ID 查询公司详情
     *
     * @param id 公司 ID
     * @return 公司详情
     */
    CompanyVO getCompanyById(Long id);

    /**
     * 创建公司
     *
     * @param request 创建请求
     * @return 是否成功
     */
    Boolean createCompany(CreateCompanyRequest request);

    /**
     * 更新公司
     *
     * @param id 公司 ID
     * @param request 更新请求
     * @return 是否成功
     */
    Boolean updateCompany(Long id, UpdateCompanyRequest request);

    /**
     * 删除公司
     *
     * @param ids 公司 ID 数组
     * @return 是否成功
     */
    Boolean deleteCompanies(Long[] ids);
}
```

```java
/**
 * 公司服务实现类
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
@Slf4j
@Service
public class CompanyServiceImpl extends ServiceImpl<CompanyMapper, Company>
    implements ICompanyService {

    @Autowired
    private CompanyMapper companyMapper;

    @Autowired
    private CompanyTranslationMapper translationMapper;

    @Autowired
    private MessageSource messageSource;

    @Override
    @Cacheable(value = "company_page", key = "#page.current + '_' + #page.size")
    public Page<CompanyVO> pageCompanies(IPage page, CompanyRequest request) {
        return baseMapper.selectPageCompany(page, request);
    }

    @Override
    @Cacheable(value = "company_detail", key = "#id")
    public CompanyVO getCompanyById(Long id) {
        Company company = getById(id);
        if (company == null) {
            // 使用国际化消息码
            throw new BusinessException(
                messageSource.getMessage("company.error.notFound", null, LocaleContextHolder.getLocale())
            );
        }
        return convertToVO(company);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean createCompany(CreateCompanyRequest request) {
        // 1. 检查名称是否已存在
        boolean exists = lambdaQuery()
            .eq(Company::getName, request.getName())
            .exists();
        if (exists) {
            // 使用国际化消息码
            throw new BusinessException(
                messageSource.getMessage("company.error.nameExists", null, LocaleContextHolder.getLocale())
            );
        }

        // 2. 构建实体
        Company company = new Company();
        BeanUtil.copyProperties(request, company);
        company.setStatus("active");
        company.setIssueCounter(0);

        // 3. 保存
        boolean saved = save(company);
        if (!saved) {
            throw new BusinessException(
                messageSource.getMessage("common.error.saveFailed", null, LocaleContextHolder.getLocale())
            );
        }

        return Boolean.TRUE;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "company_detail", key = "#id")
    public Boolean updateCompany(Long id, UpdateCompanyRequest request) {
        // 1. 检查公司是否存在
        Company company = getById(id);
        if (company == null) {
            throw new BusinessException(
                messageSource.getMessage("company.error.notFound", null, LocaleContextHolder.getLocale())
            );
        }

        // 2. 构建更新实体
        Company updateEntity = new Company();
        BeanUtil.copyProperties(request, updateEntity);
        updateEntity.setId(id);

        // 3. 更新
        boolean updated = updateById(updateEntity);
        return updated;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "company_detail", allEntries = true)
    public Boolean deleteCompanies(Long[] ids) {
        // 逻辑删除
        boolean removed = removeByIds(Arrays.asList(ids));
        return removed;
    }

    /**
     * 转换为 VO
     */
    private CompanyVO convertToVO(Company company) {
        CompanyVO vo = new CompanyVO();
        BeanUtil.copyProperties(company, vo);
        return vo;
    }
}
```

**要点**：
- 服务实现继承 `ServiceImpl<M, T>`
- 使用 `@Cacheable` 缓存查询结果
- 使用 `@CacheEvict` 清除缓存
- 使用 `@Transactional` 管理事务
- 使用 `lambdaQuery()` 进行类型安全查询
- **所有错误消息必须使用 `MessageSource` 获取国际化消息**
- 使用 `BeanUtil` 进行对象转换
- 使用 `LocaleContextHolder` 获取当前用户语言环境

#### 1.3.3 Mapper 层规范

```java
/**
 * 公司 Mapper 接口
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
public interface CompanyMapper extends BaseMapper<Company> {

    /**
     * 分页查询公司
     *
     * @param page 分页参数
     * @param request 查询条件
     * @return 分页结果
     */
    Page<CompanyVO> selectPageCompany(IPage page, @Param("request") CompanyRequest request);

    /**
     * 根据名称查询公司
     *
     * @param name 公司名称
     * @return 公司实体
     */
    Company selectByName(@Param("name") String name);
}
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="org.springblade.jigongopc.company.mapper.CompanyMapper">

    <!-- 结果映射 -->
    <resultMap id="companyVOMap" type="org.springblade.jigongopc.company.vo.CompanyVO">
        <id property="id" column="id"/>
        <result property="name" column="name"/>
        <result property="description" column="description"/>
        <result property="status" column="status"/>
        <result property="issuePrefix" column="issue_prefix"/>
        <result property="budgetMonthlyCents" column="budget_monthly_cents"/>
        <result property="spentMonthlyCents" column="spent_monthly_cents"/>
        <result property="createTime" column="create_time"/>
        <result property="updateTime" column="update_time"/>
    </resultMap>

    <!-- 分页查询 -->
    <select id="selectPageCompany" resultMap="companyVOMap">
        SELECT
            c.id,
            c.name,
            c.description,
            c.status,
            c.issue_prefix,
            c.budget_monthly_cents,
            c.spent_monthly_cents,
            c.create_time,
            c.update_time
        FROM t_company c
        WHERE c.is_deleted = 0
        <if test="request.status != null and request.status != ''">
            AND c.status = #{request.status}
        </if>
        <if test="request.keyword != null and request.keyword != ''">
            AND (c.name LIKE CONCAT('%', #{request.keyword}, '%')
                 OR c.description LIKE CONCAT('%', #{request.keyword}, '%'))
        </if>
        ORDER BY c.create_time DESC
    </select>

    <!-- 根据名称查询 -->
    <select id="selectByName" resultType="org.springblade.jigongopc.company.entity.Company">
        SELECT * FROM t_company
        WHERE name = #{name} AND is_deleted = 0
    </select>

</mapper>
```

**要点**：
- Mapper 接口继承 `BaseMapper<T>`
- XML 命名空间与 Mapper 接口全限定名一致
- 使用 `<if>` 进行动态 SQL 拼接
- 逻辑删除条件 `is_deleted = 0` 必须包含

### 1.4 实体规范

```java
/**
 * 公司实体类
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
@Data
@TableName("t_company")
@ApiModel(value = "公司对象")
public class Company extends BaseEntity {

    /**
     * 主键 ID
     */
    @TableId(type = IdType.ASSIGN_ID)
    @ApiModelProperty(value = "主键 ID")
    private Long id;

    /**
     * 公司名称
     */
    @NotBlank(message = "公司名称不能为空")
    @ApiModelProperty(value = "公司名称", required = true)
    private String name;

    /**
     * 公司描述
     */
    @ApiModelProperty(value = "公司描述")
    private String description;

    /**
     * 公司状态：active=活跃，paused=暂停，archived=归档
     */
    @ApiModelProperty(value = "公司状态：active=活跃，paused=暂停，archived=归档")
    private String status;

    /**
     * 问题前缀
     */
    @NotBlank(message = "问题前缀不能为空")
    @ApiModelProperty(value = "问题前缀", required = true)
    private String issuePrefix;

    /**
     * 问题计数器
     */
    @ApiModelProperty(value = "问题计数器")
    private Integer issueCounter;

    /**
     * 月度预算（分）
     */
    @ApiModelProperty(value = "月度预算（分）")
    private Long budgetMonthlyCents;

    /**
     * 月度支出（分）
     */
    @ApiModelProperty(value = "月度支出（分）")
    private Long spentMonthlyCents;

    /**
     * 创建用户 ID
     */
    @ApiModelProperty(value = "创建用户 ID")
    private Long createUser;

    /**
     * 创建部门 ID
     */
    @ApiModelProperty(value = "创建部门 ID")
    private Long createDept;

    /**
     * 创建时间
     */
    @ApiModelProperty(value = "创建时间")
    private LocalDateTime createTime;

    /**
     * 更新用户 ID
     */
    @ApiModelProperty(value = "更新用户 ID")
    private Long updateUser;

    /**
     * 更新时间
     */
    @ApiModelProperty(value = "更新时间")
    private LocalDateTime updateTime;

    /**
     * 是否已删除
     */
    @ApiModelProperty(value = "是否已删除")
    @TableLogic
    private Boolean isDeleted;
}
```

**要点**：
- 实体继承 `BaseEntity` 获取审计字段
- 使用 `@TableName` 指定表名
- 使用 `@TableId` 指定主键策略
- 使用 `@TableLogic` 指定逻辑删除字段
- 使用 `@ApiModelProperty` 添加 API 文档说明
- 使用 `@NotBlank` 等校验注解

### 1.5 DTO/VO 规范

```java
/**
 * 公司查询请求
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
@Data
@ApiModel(value = "公司查询请求")
public class CompanyRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 关键字
     */
    @ApiModelProperty(value = "关键字")
    private String keyword;

    /**
     * 公司状态
     */
    @ApiModelProperty(value = "公司状态")
    private String status;

    /**
     * 当前页
     */
    @ApiModelProperty(value = "当前页", defaultValue = "1")
    private Integer current = 1;

    /**
     * 每页大小
     */
    @ApiModelProperty(value = "每页大小", defaultValue = "10")
    private Integer size = 10;
}
```

```java
/**
 * 创建公司请求
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
@Data
@ApiModel(value = "创建公司请求")
public class CreateCompanyRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 公司名称
     */
    @NotBlank(message = "公司名称不能为空")
    @Size(min = 2, max = 100, message = "公司名称长度必须在 2-100 之间")
    @ApiModelProperty(value = "公司名称", required = true, example = "示例公司")
    private String name;

    /**
     * 公司描述
     */
    @Size(max = 500, message = "公司描述不能超过 500 字")
    @ApiModelProperty(value = "公司描述", example = "这是一家示例公司")
    private String description;

    /**
     * 问题前缀
     */
    @NotBlank(message = "问题前缀不能为空")
    @Pattern(regexp = "^[A-Z]{2,10}$", message = "问题前缀必须为 2-10 位大写字母")
    @ApiModelProperty(value = "问题前缀", required = true, example = "DEMO")
    private String issuePrefix;

    /**
     * 月度预算（分）
     */
    @Min(value = 0, message = "预算不能为负数")
    @ApiModelProperty(value = "月度预算（分）", example = "100000")
    private Long budgetMonthlyCents;
}
```

```java
/**
 * 公司视图对象
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
@Data
@ApiModel(value = "公司视图对象")
public class CompanyVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 主键 ID
     */
    @ApiModelProperty(value = "主键 ID")
    private Long id;

    /**
     * 公司名称
     */
    @ApiModelProperty(value = "公司名称")
    private String name;

    /**
     * 公司描述
     */
    @ApiModelProperty(value = "公司描述")
    private String description;

    /**
     * 公司状态
     */
    @ApiModelProperty(value = "公司状态")
    private String status;

    /**
     * 问题前缀
     */
    @ApiModelProperty(value = "问题前缀")
    private String issuePrefix;

    /**
     * 月度预算（分）
     */
    @ApiModelProperty(value = "月度预算（分）")
    private Long budgetMonthlyCents;

    /**
     * 月度支出（分）
     */
    @ApiModelProperty(value = "月度支出（分）")
    private Long spentMonthlyCents;

    /**
     * 预算使用率
     */
    @ApiModelProperty(value = "预算使用率")
    private BigDecimal budgetUsageRate;

    /**
     * 创建时间
     */
    @ApiModelProperty(value = "创建时间")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "UTC")
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @ApiModelProperty(value = "更新时间")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "UTC")
    private LocalDateTime updateTime;
}
```

**要点**：
- DTO/VO 实现 `Serializable` 接口
- 使用 `@ApiModelProperty` 添加说明
- 使用校验注解进行参数验证
- VO 中时间字段使用 `@JsonFormat` 格式化

### 1.6 异常处理规范

```java
/**
 * 业务异常类
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
public class BusinessException extends RuntimeException {

    /**
     * 错误码
     */
    private final Integer code;

    /**
     * 错误消息
     */
    private final String message;

    public BusinessException(String message) {
        super(message);
        this.code = 400;
        this.message = message;
    }

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
        this.message = message;
    }

    public Integer getCode() {
        return code;
    }

    @Override
    public String getMessage() {
        return message;
    }
}
```

```java
/**
 * 全局异常处理器
 *
 * @author JiGongOpc Team
 * @since 2026-03-14
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 业务异常处理
     */
    @ExceptionHandler(BusinessException.class)
    public R<Void> handleBusinessException(BusinessException e) {
        log.warn("业务异常：{}", e.getMessage());
        return R.fail(e.getCode(), e.getMessage());
    }

    /**
     * 参数校验异常处理
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public R<Void> handleValidationException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .collect(Collectors.joining(", "));
        log.warn("参数校验失败：{}", message);
        return R.fail(400, message);
    }

    /**
     * 系统异常处理
     */
    @ExceptionHandler(Exception.class)
    public R<Void> handleException(Exception e) {
        log.error("系统异常", e);
        return R.fail(500, "系统异常，请联系管理员");
    }
}
```

### 1.7 日志规范

```java
@Slf4j
@Service
public class CompanyServiceImpl implements ICompanyService {

    @Override
    public CompanyVO getCompanyById(Long id) {
        log.debug("查询公司详情，id={}", id);

        Company company = getById(id);
        if (company == null) {
            log.warn("公司不存在，id={}", id);
            throw new BusinessException("公司不存在");
        }

        log.info("查询公司详情成功，id={}, name={}", id, company.getName());
        return convertToVO(company);
    }

    @Override
    public Boolean createCompany(CreateCompanyRequest request) {
        log.info("创建公司，request={}", request);

        // 业务逻辑...

        log.info("创建公司成功，id={}", company.getId());
        return Boolean.TRUE;
    }
}
```

**日志级别使用规范**：
- `ERROR`：系统错误、异常堆栈
- `WARN`：警告信息、可恢复错误
- `INFO`：关键业务操作（创建、更新、删除）
- `DEBUG`：调试信息、详细流程
- `TRACE`：详细追踪信息

### 1.8 缓存规范

```java
@Service
public class CompanyServiceImpl implements ICompanyService {

    /**
     * 查询单个公司 - 使用缓存
     */
    @Override
    @Cacheable(value = "company", key = "#id", unless = "#result == null")
    public CompanyVO getCompanyById(Long id) {
        log.debug("查询公司详情（无缓存）, id={}", id);
        Company company = getById(id);
        return convertToVO(company);
    }

    /**
     * 创建公司 - 清除缓存
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "company", allEntries = true)
    public Boolean createCompany(CreateCompanyRequest request) {
        // ...
        return Boolean.TRUE;
    }

    /**
     * 更新公司 - 清除单个缓存
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "company", key = "#id")
    public Boolean updateCompany(Long id, UpdateCompanyRequest request) {
        // ...
        return Boolean.TRUE;
    }

    /**
     * 删除公司 - 清除所有缓存
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    @CacheEvict(value = "company", allEntries = true)
    public Boolean deleteCompanies(Long[] ids) {
        // ...
        return Boolean.TRUE;
    }
}
```

**缓存配置**：
```yaml
spring:
  cache:
    type: redis
    redis:
      time-to-live: 3600000  # 1 小时
      cache-null-values: false
      key-prefix: "jigongopc:"
```

---

## 二、Web 前端技术开发规范

### 2.1 项目结构规范

```
web/saber3-jigongopc/
├── src/
│   ├── views/                      # 页面组件
│   │   └── jigongopc/              # JiGongOpc 业务模块
│   │       ├── company/            # 公司管理
│   │       │   ├── company-list.vue
│   │       │   ├── company-form.vue
│   │       │   └── company-detail.vue
│   │       ├── agent/              # Agent 管理
│   │       ├── task/               # 任务管理
│   │       ├── goal/               # 目标管理
│   │       ├── approval/           # 审批管理
│   │       └── cost/               # 成本管理
│   ├── api/                        # API 客户端
│   │   └── jigongopc/              # JiGongOpc API
│   │       ├── company.js
│   │       ├── agent.js
│   │       └── ...
│   ├── components/                 # 公共组件
│   │   └── jigongopc/              # JiGongOpc 专用组件
│   │       ├── StatusBadge.vue
│   │       ├── PriorityIcon.vue
│   │       └── CompanySelector.vue
│   ├── locales/                    # 国际化资源
│   │   ├── zh-CN/
│   │   │   └── jigongopc/
│   │   │       ├── common.json
│   │   │       ├── company.json
│   │   │       └── ...
│   │   └── en-US/
│   ├── store/                      # Vuex 状态管理
│   │   └── modules/
│   │       └── jigongopc.js
│   ├── router/                     # 路由配置
│   │   └── routes/
│   │       └── jigongopc.js
│   ├── utils/                      # 工具函数
│   │   └── jigongopc/
│   │       ├── format.js
│   │       └── validator.js
│   └── styles/                     # 样式文件
│       └── jigongopc/
│           ├── variables.scss
│           └── theme.scss
├── package.json
└── vite.config.js
```

### 2.2 命名规范

#### 2.2.1 文件命名

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| Vue 组件 | 大驼峰.vue | `CompanyList.vue`, `AgentForm.vue` |
| API 文件 | 小写.js | `company.js`, `agent.js` |
| 样式文件 | 小写.scss | `variables.scss`, `theme.scss` |
| 工具函数 | 小写.js | `format.js`, `validator.js` |
| 国际化文件 | 小写.json | `common.json`, `company.json` |

#### 2.2.2 组件命名

```javascript
// 组件名使用大驼峰
export default {
  name: 'CompanyList',
  // ...
};
```

#### 2.2.3 变量命名

```javascript
// 变量 - 小驼峰
const companyList = ref([]);
const isLoading = ref(false);

// 常量 - 全大写
const API_BASE_URL = '/api/jigongopc';
const DEFAULT_PAGE_SIZE = 10;

// 函数 - 小驼峰
function fetchCompanies() {
  // ...
}

// 组件引用 - 小驼峰
const companyFormRef = ref(null);
```

### 2.3 组件开发规范

#### 2.3.1 列表页组件

```vue
<template>
  <div class="company-list">
    <!-- 页头 -->
    <div class="page-header">
      <h2 class="page-title">{{ t('company.title') }}</h2>
      <el-button type="primary" @click="handleCreate">
        {{ t('company.create') }}
      </el-button>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchForm.keyword"
        :placeholder="t('company.searchPlaceholder')"
        clearable
        @keyup.enter="handleSearch"
      />
      <el-select v-model="searchForm.status" :placeholder="t('company.status')">
        <el-option label="活跃" value="active" />
        <el-option label="暂停" value="paused" />
        <el-option label="归档" value="archived" />
      </el-select>
      <el-button type="primary" @click="handleSearch">
        {{ t('common.search') }}
      </el-button>
    </div>

    <!-- 表格 -->
    <div class="table-container">
      <el-table
        v-loading="loading"
        :data="companyList"
        border
        stripe
      >
        <el-table-column prop="name" :label="t('company.fields.name')" />
        <el-table-column prop="status" :label="t('company.fields.status')">
          <template #default="{ row }">
            <StatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="issuePrefix" :label="t('company.fields.issuePrefix')" />
        <el-table-column prop="budgetMonthlyCents" :label="t('company.fields.budgetMonthlyCents')">
          <template #default="{ row }">
            {{ formatCurrency(row.budgetMonthlyCents) }}
          </template>
        </el-table-column>
        <el-table-column prop="createTime" :label="t('company.fields.createTime')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="200">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleView(row)">
              {{ t('common.view') }}
            </el-button>
            <el-button link type="primary" @click="handleEdit(row)">
              {{ t('common.edit') }}
            </el-button>
            <el-button link type="danger" @click="handleDelete(row)">
              {{ t('common.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.current"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import StatusBadge from '@/components/jigongopc/StatusBadge.vue';
import companyApi from '@/api/jigongopc/company';
import { formatCurrency, formatTime } from '@/utils/jigongopc/format';

// 国际化
const { t } = useI18n();

// 加载状态
const loading = ref(false);

// 公司列表
const companyList = ref([]);

// 搜索表单
const searchForm = reactive({
  keyword: '',
  status: '',
});

// 分页
const pagination = reactive({
  current: 1,
  size: 10,
  total: 0,
});

// 加载公司列表
const fetchCompanies = async () => {
  loading.value = true;
  try {
    const { data } = await companyApi.getPage({
      current: pagination.current,
      size: pagination.size,
      ...searchForm,
    });
    companyList.value = data.records;
    pagination.total = data.total;
  } catch (error) {
    ElMessage.error(t('common.error.loadFailed'));
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  pagination.current = 1;
  fetchCompanies();
};

// 分页变化
const handleSizeChange = () => {
  fetchCompanies();
};

const handlePageChange = () => {
  fetchCompanies();
};

// 创建
const handleCreate = () => {
  // TODO: 打开创建表单
};

// 查看详情
const handleView = (row) => {
  // TODO: 导航到详情页
};

// 编辑
const handleEdit = (row) => {
  // TODO: 打开编辑表单
};

// 删除
const handleDelete = (row) => {
  ElMessageBox.confirm(
    t('company.deleteConfirm', { name: row.name }),
    t('common.confirm'),
    { type: 'warning' }
  ).then(async () => {
    try {
      await companyApi.delete([row.id]);
      ElMessage.success(t('common.success.delete'));
      fetchCompanies();
    } catch (error) {
      ElMessage.error(t('common.error.deleteFailed'));
    }
  });
};

// 生命周期
onMounted(() => {
  fetchCompanies();
});
</script>

<style lang="scss" scoped>
.company-list {
  padding: 24px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .page-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .filter-bar {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
  }

  .table-container {
    .pagination-container {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
    }
  }
}
</style>
```

**要点**：
- 使用 `<script setup>` 语法
- 使用 `useI18n` 进行国际化
- 使用 `ElMessage` 和 `ElMessageBox` 进行用户反馈
- 样式使用 scoped 避免污染
- 使用 CSS 变量实现主题

### 2.4 API 客户端规范

```javascript
// src/api/jigongopc/company.js
import request from '@/utils/request';

/**
 * 分页查询公司列表
 * @param {Object} params 查询参数
 * @returns {Promise}
 */
export function getPage(params) {
  return request({
    url: '/api/company/page',
    method: 'get',
    params,
  });
}

/**
 * 查询公司详情
 * @param {number} id 公司 ID
 * @returns {Promise}
 */
export function getById(id) {
  return request({
    url: `/api/company/${id}`,
    method: 'get',
  });
}

/**
 * 创建公司
 * @param {Object} data 创建请求
 * @returns {Promise}
 */
export function create(data) {
  return request({
    url: '/api/company',
    method: 'post',
    data,
  });
}

/**
 * 更新公司
 * @param {number} id 公司 ID
 * @param {Object} data 更新请求
 * @returns {Promise}
 */
export function update(id, data) {
  return request({
    url: `/api/company/${id}`,
    method: 'put',
    data,
  });
}

/**
 * 删除公司
 * @param {Array<number>} ids 公司 ID 数组
 * @returns {Promise}
 */
export function deleteByIds(ids) {
  return request({
    url: '/api/company',
    method: 'delete',
    params: { ids },
  });
}

export default {
  getPage,
  getById,
  create,
  update,
  deleteByIds,
};
```

### 2.5 国际化规范

```json
// src/locales/zh-CN/jigongopc/company.json
{
  "title": "公司管理",
  "create": "创建公司",
  "edit": "编辑公司",
  "delete": "删除公司",
  "deleteConfirm": "确定要删除公司「{name}」吗？",
  "searchPlaceholder": "搜索公司名称...",
  "fields": {
    "name": "公司名称",
    "description": "公司描述",
    "status": "状态",
    "issuePrefix": "问题前缀",
    "budgetMonthlyCents": "月度预算",
    "spentMonthlyCents": "月度支出",
    "createTime": "创建时间",
    "updateTime": "更新时间"
  },
  "status": {
    "active": "活跃",
    "paused": "暂停",
    "archived": "归档"
  },
  "form": {
    "nameRequired": "请输入公司名称",
    "nameLength": "公司名称长度必须在 2-100 之间",
    "issuePrefixRequired": "请输入问题前缀",
    "issuePrefixPattern": "问题前缀必须为 2-10 位大写字母",
    "saveSuccess": "保存成功",
    "saveFailed": "保存失败"
  }
}
```

```vue
<!-- 组件中使用 -->
<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// 使用翻译
console.log(t('company.title'));
console.log(t('company.deleteConfirm', { name: '示例公司' }));
</script>
```

### 2.6 样式规范

```scss
// src/styles/jigongopc/variables.scss

// 颜色变量
:root {
  // 主题色
  --jp-color-primary: #4a8eff;
  --jp-color-success: #42c96d;
  --jp-color-warning: #e6c84a;
  --jp-color-danger: #f56c6c;
  --jp-color-info: #8a8f99;

  // 背景色（深色主题）
  --jp-bg-primary: #1a1d26;
  --jp-bg-surface: #1f232e;
  --jp-bg-border: #2d3342;

  // 文字色
  --jp-text-primary: #e8e8e8;
  --jp-text-secondary: #8a8f99;

  // 间距
  --jp-spacing-xs: 4px;
  --jp-spacing-sm: 8px;
  --jp-spacing-md: 16px;
  --jp-spacing-lg: 24px;
  --jp-spacing-xl: 32px;

  // 圆角
  --jp-radius-sm: 4px;
  --jp-radius-md: 8px;
  --jp-radius-lg: 12px;

  // 字体
  --jp-font-size-xs: 11px;
  --jp-font-size-sm: 13px;
  --jp-font-size-base: 14px;
  --jp-font-size-lg: 16px;
  --jp-font-size-xl: 18px;
}
```

```scss
// src/styles/jigongopc/theme.scss

// 通用样式
.jp-container {
  padding: var(--jp-spacing-lg);
}

.jp-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--jp-spacing-lg);

  .jp-page-title {
    font-size: var(--jp-font-size-xl);
    font-weight: 600;
    color: var(--jp-text-primary);
  }
}

.jp-card {
  background: var(--jp-bg-surface);
  border: 1px solid var(--jp-bg-border);
  border-radius: var(--jp-radius-md);
  padding: var(--jp-spacing-lg);
}

.jp-status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--jp-spacing-xs);
  padding: var(--jp-spacing-xs) var(--jp-spacing-sm);
  border-radius: var(--jp-radius-lg);
  font-size: var(--jp-font-size-xs);

  .jp-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  &.jp-status--active .jp-status-dot {
    background: var(--jp-color-success);
  }

  &.jp-status--paused .jp-status-dot {
    background: var(--jp-color-warning);
  }

  &.jp-status--archived .jp-status-dot {
    background: var(--jp-color-info);
  }
}
```

---

## 三、移动端 H5 技术开发规范

### 3.1 项目结构规范

```
mobile/h5/
├── src/
│   ├── pages/                      # 页面组件
│   │   ├── company/
│   │   │   ├── list.vue           # 公司列表
│   │   │   ├── detail.vue         # 公司详情
│   │   │   └── form.vue           # 公司表单
│   │   └── ...
│   ├── components/                 # 通用组件
│   │   └── jigongopc/
│   ├── api/                        # API 客户端
│   ├── store/                      # Vuex 状态管理
│   ├── locales/                    # 国际化资源
│   ├── utils/                      # 工具函数
│   └── styles/                     # 样式文件
├── manifest.json                   # 应用配置
├── pages.json                      # 页面配置
└── package.json
```

### 3.2 响应式布局规范

```vue
<template>
  <view class="company-list">
    <!-- 页头 -->
    <view class="page-header">
      <text class="page-title">{{ t('company.title') }}</text>
      <button class="create-btn" @click="handleCreate">
        {{ t('company.create') }}
      </button>
    </view>

    <!-- 列表 -->
    <scroll-view scroll-y class="list-container">
      <view
        v-for="company in companyList"
        :key="company.id"
        class="company-item"
        @click="handleView(company)"
      >
        <view class="company-info">
          <text class="company-name">{{ company.name }}</text>
          <text class="company-desc">{{ company.description }}</text>
        </view>
        <view class="company-status">
          <StatusBadge :status="company.status" />
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.company-list {
  display: flex;
  flex-direction: column;
  height: 100vh;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #fff;
    border-bottom: 1px solid #eee;

    .page-title {
      font-size: 20px;
      font-weight: 600;
    }

    .create-btn {
      padding: 8px 16px;
      font-size: 14px;
    }
  }

  .list-container {
    flex: 1;
    padding: 16px;

    .company-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      margin-bottom: 12px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
  }
}
</style>
```

### 3.3 触摸交互规范

- **最小触摸区域**：44x44px
- **按钮高度**：48px
- **列表项高度**：56px
- **支持手势**：滑动删除、下拉刷新、上拉加载

---

## 四、桌面端技术开发规范

### 4.1 Electron 项目结构

```
desktop/electron/
├── src/
│   ├── main/                       # 主进程
│   │   ├── main.js                # 主进程入口
│   │   ├── window.js              # 窗口管理
│   │   └── menu.js                # 菜单管理
│   ├── preload/                    # 预加载脚本
│   │   └── preload.js
│   └── renderer/                   # 渲染进程（复用 Web 端代码）
├── build/                          # 构建配置
│   └── builder.yml
├── package.json
└── electron-builder.yml
```

### 4.2 主进程规范

```javascript
// src/main/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../icon.png'),
  });

  // 加载应用
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

---

## 五、客户端技术开发规范

### 5.1 Uni-app 项目结构

```
mobile/uni-app/
├── src/
│   ├── pages/                      # 页面
│   │   └── jigongopc/
│   │       ├── company/
│   │       ├── agent/
│   │       └── task/
│   ├── components/                 # 组件
│   ├── api/                        # API
│   ├── store/                      # 状态管理
│   ├── locales/                    # 国际化
│   ├── utils/                      # 工具
│   ├── static/                     # 静态资源
│   └── styles/                     # 样式
├── manifest.json                   # 应用配置
├── pages.json                      # 页面配置
└── package.json
```

### 5.2 鸿蒙 ArkTS 项目结构

```
mobile/harmony/
├── entry/
│   └── src/
│       └── main/
│           ├── ets/
│           │   ├── entryability/
│           │   ├── pages/
│           │   │   ├── CompanyList.ets
│           │   │   ├── CompanyDetail.ets
│           │   │   └── ...
│           │   ├── components/
│           │   ├── api/
│           │   └── common/
│           └── resources/
└── hvigorfile.ts
```

---

## 六、国际化消息码规范

### 6.1 消息码命名规则

消息码采用分层命名，格式为：`模块。子模块。用途。具体项`

| 层级 | 说明 | 示例 |
|------|------|------|
| 第一层 | 模块名 | `common`, `company`, `agent`, `task` |
| 第二层 | 子模块/分类 | `form`, `error`, `status`, `fields` |
| 第三层 | 用途 | `name`, `title`, `message` |
| 第四层 | 具体项（可选） | `required`, `exists`, `notFound` |

### 6.2 通用消息码（common）

所有模块共享的通用消息码：

```properties
# 通用操作
common.title=JiGongOpc
common.loading=加载中...
common.search=搜索
common.searchPlaceholder=请输入关键字...
common.create=创建
common.edit=编辑
common.delete=删除
common.save=保存
common.cancel=取消
common.confirm=确认
common.submit=提交
common.back=返回
common.refresh=刷新
common.actions=操作
common.view=查看
common.detail=详情
common.settings=设置
common.profile=个人资料
common.logout=退出登录
common.language=语言

# 状态
common.status=状态
common.status.active=活跃
common.status.paused=暂停
common.status.archived=归档
common.status.pending=待处理
common.status.approved=已批准
common.status.rejected=已拒绝
common.status.cancelled=已取消

# 优先级
common.priority=优先级
common.priority.critical=紧急
common.priority.high=高
common.priority.medium=中
common.priority.low=低

# 通用错误
common.error.notFound=记录不存在
common.error.saveFailed=保存失败
common.error.saveSuccess=保存成功
common.error.deleteFailed=删除失败
common.error.deleteSuccess=删除成功
common.error.loadFailed=加载失败
common.error.networkError=网络错误，请检查网络连接
common.error.systemError=系统错误，请联系管理员
common.error.unauthorized=未授权，请先登录
common.error.forbidden=无权限访问

# 通用提示
common.noData=暂无数据
common.deleteConfirm=确定要删除{0}「{1}」吗？
common.confirmTitle=确认操作
common.saveSuccess=保存成功
common.operationSuccess=操作成功
common.operationFailed=操作失败
```

### 6.3 公司模块消息码（company）

```properties
# 公司模块 - 基础
company.title=公司管理
company.create=创建公司
company.edit=编辑公司
company.delete=删除公司
company.searchPlaceholder=搜索公司名称...

# 公司模块 - 字段
company.fields.name=公司名称
company.fields.description=公司描述
company.fields.status=状态
company.fields.issuePrefix=问题前缀
company.fields.budgetMonthlyCents=月度预算
company.fields.spentMonthlyCents=月度支出
company.fields.createTime=创建时间
company.fields.updateTime=更新时间
company.fields.createdBy=创建人
company.fields.updatedBy=更新人

# 公司模块 - 状态
company.status.active=活跃
company.status.paused=暂停
company.status.archived=归档

# 公司模块 - 表单验证
company.form.nameRequired=请输入公司名称
company.form.nameLength=公司名称长度必须在 2-100 之间
company.form.nameExists=公司名称已存在
company.form.issuePrefixRequired=请输入问题前缀
company.form.issuePrefixPattern=问题前缀必须为 2-10 位大写字母
company.form.saveSuccess=保存成功
company.form.saveFailed=保存失败

# 公司模块 - 错误
company.error.notFound=公司不存在
company.error.nameExists=公司名称已存在
company.error.deleteHasData=公司下存在关联数据，无法删除
```

### 6.4 Agent 模块消息码（agent）

```properties
# Agent 模块 - 基础
agent.title=Agent 管理
agent.create=创建 Agent
agent.edit=编辑 Agent
agent.delete=删除 Agent
agent.searchPlaceholder=搜索 Agent 名称...

# Agent 模块 - 字段
agent.fields.name=名称
agent.fields.role=角色
agent.fields.title=头衔
agent.fields.status=状态
agent.fields.reportsTo=汇报对象
agent.fields.capabilities=能力描述
agent.fields.adapterType=适配器类型
agent.fields.budgetMonthlyCents=月度预算

# Agent 模块 - 状态
agent.status.idle=空闲
agent.status.running=运行中
agent.status.paused=已暂停
agent.status.error=错误
agent.status.terminated=已终止

# Agent 模块 - 错误
agent.error.notFound=Agent 不存在
agent.error.nameExists=Agent 名称已存在
agent.error.deleteHasTasks=Agent 有关联任务，无法删除
```

### 6.5 任务模块消息码（task/issue）

```properties
# 任务模块 - 基础
task.title=任务管理
task.create=创建任务
task.edit=编辑任务
task.delete=删除任务
task.searchPlaceholder=搜索任务...

# 任务模块 - 字段
task.fields.identifier=任务编号
task.fields.title=标题
task.fields.description=描述
task.fields.status=状态
task.fields.priority=优先级
task.fields.assignee=经办人
task.fields.project=所属项目
task.fields.goal=所属目标
task.fields.startDate=开始日期
task.fields.targetDate=目标日期
task.fields.completedDate=完成日期

# 任务模块 - 状态
task.status.backlog=待办
task.status.todo=待处理
task.status.inProgress=进行中
task.status.inReview=审查中
task.status.done=已完成
task.status.cancelled=已取消
task.status.blocked=已阻塞

# 任务模块 - 优先级
task.priority.critical=紧急
task.priority.high=高
task.priority.medium=中
task.priority.low=低

# 任务模块 - 错误
task.error.notFound=任务不存在
task.error.invalidStatusChange=无效的状态转换
```

### 6.6 审批模块消息码（approval）

```properties
# 审批模块 - 基础
approval.title=审批管理
approval.approve=批准
approval.reject=拒绝
approval.pending=待审批

# 审批模块 - 类型
approval.type.hireAgent=雇佣 Agent
approval.type.createCompany=创建公司
approval.type.budget=预算审批

# 审批模块 - 状态
approval.status.pending=待审批
approval.status.approved=已批准
approval.status.rejected=已拒绝
approval.status.cancelled=已取消

# 审批模块 - 错误
approval.error.notFound=审批记录不存在
approval.error.alreadyProcessed=该审批已被处理
```

### 6.7 国际化属性文件规范

#### 6.7.1 文件命名

```
src/main/resources/i18n/
├── messages.properties              # 默认（英文）
├── messages_zh_CN.properties        # 简体中文
├── messages_en_US.properties        # 英文
├── messages_ja_JP.properties        # 日文
├── messages_ko_KR.properties        # 韩文
├── messages_zh_TW.properties        # 繁体中文
├── messages_de_DE.properties        # 德文
├── messages_fr_FR.properties        # 法文
└── messages_es_ES.properties        # 西班牙文
```

#### 6.7.2 编码规范

- 所有属性文件必须使用 **UTF-8** 编码
- 中文内容可以直接写入（Java 9+ 支持 UTF-8 properties）
- 如需兼容 Java 8，使用 `native2ascii` 工具转换

#### 6.7.3 占位符规范

使用 `{0}`, `{1}`, `{2}` 等作为占位符：

```properties
common.deleteConfirm=确定要删除{0}「{1}」吗？
common.welcome=欢迎，{0}！
```

在代码中使用：

```java
String message = messageSource.getMessage(
    "common.deleteConfirm",
    new Object[]{"公司", "示例公司"},
    locale
);
// 结果：确定要删除公司「示例公司」吗？
```

### 6.8 前端语言切换流程

```
1. 用户点击语言切换器
   ↓
2. 更新 localStorage.locale
   ↓
3. 设置 i18n.locale
   ↓
4. 所有组件重新渲染
   ↓
5. 后续 API 请求头携带 Accept-Language
```

### 6.9 后端语言解析流程

```
1. 请求到达
   ↓
2. 拦截器从 Accept-Language Header 解析语言
   ↓
3. 设置 LocaleContextHolder
   ↓
4. 业务代码使用 LocaleContextHolder.getLocale()
   ↓
5. MessageSource 返回对应语言的翻译
   ↓
6. 响应中返回对应语言的消息
```

### 6.10 强制规范

**所有用户可见文案必须使用国际化，禁止硬编码：**

❌ 错误示例：
```java
throw new BusinessException("公司不存在");
ElMessage.error("保存失败");
```

✅ 正确示例：
```java
throw new BusinessException(
    messageSource.getMessage("company.error.notFound", null, LocaleContextHolder.getLocale())
);
ElMessage.error(t('common.error.saveFailed'));
```

---

## 七、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
| v1.1 | 2026-03-14 | AI Assistant | 添加完整的国际化消息码规范，禁止硬编码文案 |
