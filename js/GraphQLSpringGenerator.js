class GraphQLSpringGenerator {
    /**
     * Constructs a new GraphQLSpringGenerator instance.
     * Initializes all configuration properties and model to null.
     */
    constructor() {
        this.packageName = null;
        this.groupId = null;
        this.artifactId = null;
        this.serviceName = null;
        this.serviceDescription = null;
        this.javaVersion = null;
        this.version = null;
        this.maxRelationDepth = 3; // Default max depth for nested relations
        this.model = null;
    }

    /**
     * Generates all virtual files required for the Spring GraphQL project.
     * Includes entity, repository, service, controller, schema, and pom files.
     * @returns {Array} Array of file objects with 'name' and 'content'.
     */
    generateVirtualFiles() {
        let appConfig = {
                port: parseInt(document.querySelector('#appPort').value.trim(), 10)
            };
        let databaseConfig = {
            url: document.querySelector('#dbUrl').value.trim(),
            username: document.querySelector('#dbUsername').value.trim(),
            password: document.querySelector('#dbPassword').value, // jangan trim password
            driver: document.querySelector('#dbDriver').value.trim(),
            showSql: document.querySelector('#dbShowSql').value === 'true',      
            dialect: document.querySelector('#dbDialect').value.trim()
        };
        
        const files = [];
        files.push(...this.generateIdClassFiles());
        files.push(...this.generateEntityFiles());
        files.push(...this.generateRepositoryFiles());
        files.push(...this.generateConnectionFiles());
        files.push(...this.generateServiceFiles());
        files.push(...this.generateControllerFiles());
        files.push(...this.generateGraphQlSchema());
        files.push(...this.generatePageInfoFile());
        files.push(...this.generatePomFile());
        files.push(...this.generateApplicationFile());
        files.push(...this.generateCorsConfigFile());
        files.push(...this.generateRequestInterceptorFile());
        
        files.push(...this.generateDataFilterFile());
        files.push(...this.generateDataOrderFile());
        files.push(...this.generateFetchPropertiesFile());
        files.push(...this.generateSpecificationUtilFile());
        files.push(...this.generatePageUtilFile());
        
        
        files.push(...this.generateApplicationPropertiesFile(appConfig, databaseConfig));
        
        files.push(...Maven.generateMavenFile());
        files.push(...Maven.generateMavenCmdFile());
        files.push(...Maven.generateMavenWrapperFiles());
        
        return files;
    }

    /**
     * Creates a ZIP file containing all generated source files and triggers download.
     * @param {Object} model - The parsed model containing entities.
     * @param {Object} config - Configuration object for project properties.
     * @returns {Promise<void>}
     */
    async createZipFile(model, config = {}, outputFileName = "servicegen.zip") {
        this.packageName = config.packageName || "com.example.servicegen";
        this.groupId = config.groupId || "com.example";
        this.artifactId = config.artifactId || "servicegen";
        this.serviceName = config.serviceName || "Service Generator";
        this.serviceDescription = config.serviceDescription || "A service generator for Spring GraphQL";
        this.javaVersion = config.javaVersion || "21";
        this.version = config.version || "1.0.0";
        this.maxRelationDepth = 3; // Default max depth for nested relations
        this.model = model;

        const loadingMessage = document.getElementById('loading');
        loadingMessage.style.display = 'block';
        const virtualFiles = this.generateVirtualFiles();
        if (virtualFiles.length === 0) {
            alert('Tidak ada file untuk dikompresi.');
            loadingMessage.style.display = 'none';
            return;
        }
        const zip = new JSZip();
        for (const file of virtualFiles) {
            zip.file(file.name, file.content);
        }
        try {
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, outputFileName);
        } catch (error) {
            console.error('Gagal membuat file ZIP:', error);
        } finally {
            loadingMessage.style.display = 'none';
        }
    }

    

    /**
     * Returns all primary key columns from an entity.
     * @param {Object} entity - The entity object.
     * @returns {Array} Array of primary key columns.
     */
    getPrimaryKeys(entity) {
        return entity.columns.filter(column => column.primaryKey);
    }

    /**
     * Returns the first primary key column from an entity, with formatted properties.
     * @param {Object} entity - The entity object.
     * @returns {Object|null} Primary key info or null if not found.
     */
    getPrimatyKey(entity) {
        const pk = entity.columns.find(column => column.primaryKey);
        if (pk) {
            return {
                primaryKeyName: pk.name,
                primaryKeyCamel: stringUtil.camelize(pk.name),
                primaryKeyType: pk.type,
                primaryKeyJavaType: this.getJavaType(pk.type)
            };
        }
        return null;
    }

    /**
     * Maps SQL column type to Java type.
     * @param {string} type - The SQL column type.
     * @returns {string} The corresponding Java type.
     */
    getJavaType(type) {
        let lowercase = type.toLowerCase();
        if (lowercase.indexOf("int") !== -1 || lowercase.indexOf("integer") !== -1 || lowercase.indexOf("tinyint") !== -1) {
            return "Long";
        } else if (lowercase.indexOf("long") !== -1 || lowercase.indexOf("bigint") !== -1) {
            return "Long";
        } else if (lowercase.indexOf("string") !== -1 || lowercase.indexOf("varchar") !== -1 || lowercase.indexOf("text") !== -1) {
            return "String";
        } else if (lowercase.indexOf("boolean") !== -1) {
            return "Boolean";
        } else if (lowercase.indexOf("date") !== -1 || lowercase.indexOf("timestamp") !== -1) {
            return "Date";
        } else if (lowercase.indexOf("double") !== -1 || lowercase.indexOf("float") !== -1) {
            return "Double";
        } else if (lowercase.indexOf("uuid") !== -1) {
            return "UUID";
        } else if (lowercase.indexOf("bigdecimal") !== -1) {
            return "BigDecimal";
        } else if (lowercase.indexOf("number") !== -1 || lowercase.indexOf("real") !== -1 || lowercase.indexOf("decimal") !== -1 || lowercase.indexOf("numeric") !== -1) {
            return "Double";
        }
        return "Object";
    }

    /**
     * Creates the source directory path from the packageName string.
     * @param {string} packageName - The packageName string (e.g., 'com.example.servicegen').
     * @returns {string} The source directory path.
     */
    createSourceDirectoryFromArtefact(packageName) {
        return 'src/main/java/' + packageName.split('.').join('/') + '/';
    }
    
    generateApplicationFile() {
        const content = `package ${this.packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
`;
        return [{ name: this.createSourceDirectoryFromArtefact(this.packageName) + 'Application.java', content: content }]; 
    }
    
    generateApplicationPropertiesFile(appConfig, databaseConfig) {
        const content = `# Spring Boot application properties
# Server port
server.port=${appConfig.port || 8080}
# Database configuration
spring.datasource.url=${databaseConfig.url || 'jdbc:mysql://localhost:3306/mydb'}
spring.datasource.username=${databaseConfig.username || 'root'}
spring.datasource.password=${databaseConfig.password || ''}
spring.datasource.driver-class-name=${databaseConfig.driver || 'com.mysql.cj.jdbc.Driver'}
# JPA/Hibernate configuration
spring.jpa.show-sql=${databaseConfig.showSql || 'true'}
spring.jpa.properties.hibernate.dialect=${databaseConfig.dialect}
# GraphQL configuration
spring.graphql.schema-location=classpath:graphql/schema.graphqls
# Logging configuration
logging.level.org.springframework=INFO
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE
# Application name and description
spring.application.name=${this.serviceName}
spring.application.description=${this.serviceDescription}
# Java version
spring.java.version=${this.javaVersion}
# Package name
spring.package.name=${this.packageName}
# Version
spring.application.version=${this.version}
`;
        return [{ name: 'src/main/resources/application.properties', content: content }];
    }

    generateRequestInterceptorFile()
    {
        const content = `package ${this.packageName}.config;

import java.util.Map;

import org.springframework.graphql.server.WebGraphQlInterceptor;
import org.springframework.graphql.server.WebGraphQlRequest;
import org.springframework.graphql.server.WebGraphQlResponse;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
public class GraphQLRequestInterceptor implements WebGraphQlInterceptor {

    @Override
    public Mono<WebGraphQlResponse> intercept(WebGraphQlRequest request, Chain chain) {
        // Get all headers
        Map<String, String> headers = request.getHeaders().toSingleValueMap();

        // Get IP address
        String clientIp = request.getRemoteAddress() != null
                ? request.getRemoteAddress().getAddress().getHostAddress()
                : "UNKNOWN";

        // Put it into GraphQLContext
        request.configureExecutionInput((executionInput, builder) ->
                builder.graphQLContext(Map.of(
                        "clientIp", clientIp,
                        "headers", headers
                )).build()
        );

        return chain.next(request);
    }
}

`;
        return [{ name: this.createSourceDirectoryFromArtefact(this.packageName) + 'config/GraphQLRequestInterceptor.java', content: content }]; 
    }

    generateCorsConfigFile()
    {
        const content = `package ${this.packageName}.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/graphql/**") 
                .allowedOrigins("*") 
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowedHeaders("*");
    }
}`;
        return [{ name: this.createSourceDirectoryFromArtefact(this.packageName) + 'config/CorsConfig.java', content: content }]; 
    }
    

    /**
     * Generates controller files for all entities in the model.
     * @returns {Array} Array of controller file objects.
     */
    generateControllerFiles() {
    let entities = this.model.entities;
    let file = [];
    entities.forEach(entity => {
        let entityName = entity.name;
        let entityNameCamel = stringUtil.camelize(entityName);
        let upperCamelEntityName = stringUtil.upperCamel(entityNameCamel);
        let primaryKeys = this.getPrimaryKeys(entity);

        if (primaryKeys.length > 0) {
            let paramList = primaryKeys.map(pk => `@Argument ${this.getJavaType(pk.type)} ${stringUtil.camelize(pk.name)}`).join(', ');
            let callParams = primaryKeys.map(pk => stringUtil.camelize(pk.name)).join(', ');
            

            let controllerContent = `package ${this.packageName}.controller;

import java.util.List;

import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.stereotype.Controller;


import ${this.packageName}.output.${upperCamelEntityName}Connection;
import ${this.packageName}.utils.DataFilter;
import ${this.packageName}.utils.DataOrder;
import ${this.packageName}.entity.${upperCamelEntityName};
import ${this.packageName}.entity.${upperCamelEntityName}Input;
import ${this.packageName}.service.${upperCamelEntityName}Service;

import graphql.schema.DataFetchingEnvironment;

import lombok.RequiredArgsConstructor;


@Controller
@RequiredArgsConstructor
public class ${upperCamelEntityName}Controller {

    private final ${upperCamelEntityName}Service ${entityNameCamel}Service;

    @QueryMapping
    public ${upperCamelEntityName}Connection get${upperCamelEntityName}s(@Argument(name = "pageNumber") Integer pageNumber, @Argument(name = "pageSize") Integer pageSize, @Argument(name = "dataFilter") List<DataFilter> dataFilter, @Argument(name = "dataOrder") List<DataOrder> dataOrder, DataFetchingEnvironment env) {
        return ${entityNameCamel}Service.get${upperCamelEntityName}s(pageNumber, pageSize, dataFilter, dataOrder);
    }

    @QueryMapping
    public ${upperCamelEntityName} get${upperCamelEntityName}(${paramList}, DataFetchingEnvironment env) {
        return ${entityNameCamel}Service.get${upperCamelEntityName}(${callParams});
    }

    @MutationMapping
    public ${upperCamelEntityName} create${upperCamelEntityName}(@Argument ${upperCamelEntityName}Input input, DataFetchingEnvironment env) {
        return ${entityNameCamel}Service.create${upperCamelEntityName}(input);
    }

    @MutationMapping
    public ${upperCamelEntityName} update${upperCamelEntityName}(@Argument ${upperCamelEntityName}Input input, DataFetchingEnvironment env) {
        return ${entityNameCamel}Service.update${upperCamelEntityName}(input);
    }

    @MutationMapping
    public Boolean delete${upperCamelEntityName}(${paramList}, DataFetchingEnvironment env) {
        ${entityNameCamel}Service.delete${upperCamelEntityName}(${callParams});
        return true;
    }
}
`;
            file.push({
                name: this.createSourceDirectoryFromArtefact(this.packageName) + `controller/${upperCamelEntityName}Controller.java`,
                content: controllerContent
            });
        }
    });
    return file;
}


    /**
     * Generates service files for all entities in the model, including mutations.
     * @returns {Array} Array of service file objects.
     */
    generateServiceFiles() {
        let _this = this;
        let entities = this.model.entities;
        let file = [];
        entities.forEach(entity => {
            let entityName = entity.name;
            let entityNameCamel = stringUtil.camelize(entityName);
            let upperCamelEntityName = stringUtil.upperCamel(entityNameCamel);
            let primaryKeys = this.getPrimaryKeys(entity);
            
            let initFilter = '';
            
            entity.columns.forEach(column => {
                let dataType = _this.getDataType(column.type);
                let filterType = _this.getFilterType(dataType);
                let columnName = stringUtil.camelize(column.name);
                initFilter += `\t\tthis.fetchProperties.add("${columnName}", "${columnName}", "${dataType}", "${filterType}");\r\n`
            });

            let setIdNull = '';

            if (primaryKeys.length > 0) {
                let paramList = primaryKeys.map(pk => `${this.getJavaType(pk.type)} ${stringUtil.camelize(pk.name)}`).join(', ');
                let callParams = primaryKeys.map(pk => stringUtil.camelize(pk.name)).join(', ');
                let callParamNames = '"'+primaryKeys.map(pk => stringUtil.camelize(pk.name)).join('", "')+'"';
                let methodNameSuffix = primaryKeys.map(pk => stringUtil.upperCamel(stringUtil.camelize(pk.name))).join('And');
                
                let vals = [];
                primaryKeys.forEach(col => {
                    let upperColumnName = stringUtil.upperCamel(stringUtil.camelize(col.name));
                    vals.push(`input.get${upperColumnName}() == null`);
                    if(col.primaryKey && col.autoIncrement)
                    {
                        setIdNull = `\r\n\t\tinput.set${upperColumnName}(null);`;
                    }
                });
                let updateValidation = `if(${vals.join(' || ')})
    	{
    		return null;
    	}
        `;


                let serviceContent = `package ${this.packageName}.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

import ${this.packageName}.entity.${upperCamelEntityName};
import ${this.packageName}.entity.${upperCamelEntityName}Input;
import ${this.packageName}.output.${upperCamelEntityName}Connection;
import ${this.packageName}.repository.${upperCamelEntityName}Repository;
import ${this.packageName}.repository.${upperCamelEntityName}InputRepository;
import ${this.packageName}.utils.DataFilter;
import ${this.packageName}.utils.DataOrder;
import ${this.packageName}.utils.FetchProperties;
import ${this.packageName}.utils.PageUtil;
import ${this.packageName}.utils.SpecificationUtil;



import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;

/**
 * Service class for handling business logic and CRUD operations 
 * for the {@link ${upperCamelEntityName}} entity.
 *
 * <p>This service provides methods to query, create, update, and delete 
 * records from the database using the associated repository.</p>
 *
 * <p>Generated automatically by GraphQL Generator.</p>
 */
@Service
@RequiredArgsConstructor
public class ${upperCamelEntityName}Service {

    private final ${upperCamelEntityName}Repository ${entityNameCamel}Repository;
    private final ${upperCamelEntityName}InputRepository ${entityNameCamel}InputRepository;

    private FetchProperties fetchProperties;
    
    @PostConstruct
    public void init()
    {
    	fetchProperties = new FetchProperties();
    	
${initFilter}
    }
    
    /**
     * Retrieves a paginated and optionally filtered list of {@link ${upperCamelEntityName}} records from the database.
     * This method supports dynamic filtering and sorting based on the provided criteria,
     * and wraps the result in an {@link ${upperCamelEntityName}Connection} for pagination support.
     *
     * @param pageNumber the 1-based page number for pagination (required).
     * @param pageSize the number of records to retrieve per page (required).
     * @param dataFilter an optional list of filters to be applied to the query (may be {@code null} or empty).
     * @param dataOrder an optional list of fields and their sort order to be applied to the query (may be {@code null} or empty).
     * @return {@link ${upperCamelEntityName}Connection} object containing the paginated {@link ${upperCamelEntityName}} records
     *         that match the given filtering and sorting criteria.
     */
    public ${upperCamelEntityName}Connection get${upperCamelEntityName}s(Integer pageNumber, Integer pageSize, List<DataFilter> dataFilter, List<DataOrder> dataOrder) {
    	List<DataOrder> filteredDataOrder = this.fetchProperties.filterFieldName(dataOrder);
        Page<${upperCamelEntityName}> page = ${entityNameCamel}Repository.findAll(
        		SpecificationUtil.createSpecificationFromFilter(dataFilter, this.fetchProperties.getFilter()), 
        		PageUtil.pageRequest(pageNumber, pageSize, filteredDataOrder, ${callParamNames})
        );
        return new ${upperCamelEntityName}Connection(page);
    }

    /**
     * Retrieves ${upperCamelEntityName} record matching the given primary key.
     *
     * @param ${primaryKeys.map(pk => stringUtil.camelize(pk.name)).join(', ')} the primary key value(s) used for filtering.
     * @return a list of matching ${upperCamelEntityName} entities.
     */
    public ${upperCamelEntityName} get${upperCamelEntityName}(${paramList}) {
        return ${entityNameCamel}Repository.findOneBy${methodNameSuffix}(${callParams});
    }

    /**
     * Creates a new record for {@link ${upperCamelEntityName}} in the database.
     *
     * @param input the ${upperCamelEntityName} entity to be created.
     * @return the saved ${upperCamelEntityName} entity.
     */
    public ${upperCamelEntityName} create${upperCamelEntityName}(${upperCamelEntityName}Input input) {${setIdNull}
        ${upperCamelEntityName}Input saved = ${entityNameCamel}InputRepository.save(input);
        return ${entityNameCamel}Repository.findOneBy${methodNameSuffix}(
            ${primaryKeys.map(pk => `saved.get${stringUtil.upperCamel(stringUtil.camelize(pk.name))}()`).join(', ')}
        );
    }

    /**
     * Updates an existing {@link ${upperCamelEntityName}} record in the database.
     *
     * @param input the ${upperCamelEntityName} entity containing updated values.
     * @return the updated ${upperCamelEntityName} entity.
     */
    public ${upperCamelEntityName} update${upperCamelEntityName}(${upperCamelEntityName}Input input) {
        ${updateValidation}${upperCamelEntityName}Input saved = ${entityNameCamel}InputRepository.save(input);
        return ${entityNameCamel}Repository.findOneBy${methodNameSuffix}(
            ${primaryKeys.map(pk => `saved.get${stringUtil.upperCamel(stringUtil.camelize(pk.name))}()`).join(', ')}
        );
    }

    /**
     * Deletes the {@link ${upperCamelEntityName}} record that matches the given primary key(s).
     *
     * @param ${primaryKeys.map(pk => stringUtil.camelize(pk.name)).join(', ')} the primary key value(s) of the record to delete.
     */
    @Transactional
    public void delete${upperCamelEntityName}(${paramList}) {
        ${entityNameCamel}InputRepository.deleteBy${methodNameSuffix}(${callParams});
    }
}
`;
                file.push({
                    name: this.createSourceDirectoryFromArtefact(this.packageName) + `service/${upperCamelEntityName}Service.java`,
                    content: serviceContent
                });
            }
        });
        return file;
    }
    
    gereratePageUtilFile()
    {
        const content = `package ${this.packageName}.utils;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;

public class PageUtil {

    /**
     * Creates a Pageable object for paginated and sorted queries.
     *
     * @param pageNumber The 1-based page number. Defaults to 1 if null or less than 1.
     * @param pageSize The number of items per page. Defaults to 20, min is 1.
     * @param orderByFields An array of field names to sort by. Defaults to ascending.
     * @return A Pageable object configured with pagination and sorting.
     */
    public static Pageable pageRequest(Integer pageNumber, Integer pageSize, String... orderByFields) {
        // Handle page number: convert to 0-based and ensure it's not negative.
        int currentPage = (pageNumber != null && pageNumber > 0) ? pageNumber - 1 : 0;
        
        // Handle page size: ensure it's at least 1.
        int rowPerPage = (pageSize != null && pageSize > 0) ? pageSize : 20;

        // Create Sort object if orderByFields are provided
        Sort sort = Sort.unsorted();
        if (orderByFields != null && orderByFields.length > 0) {
            sort = Sort.by(Direction.ASC, orderByFields);
        }
        
        return PageRequest.of(currentPage, rowPerPage, sort);
    }
}
`;      return [{ 
            name: this.createSourceDirectoryFromArtefact(this.packageName) + `utils/PageUtil.java`,
            content: content 
        }];
    }
    
    generateSpecificationUtilFile()
    {
        const content = `package ${this.packageName}.utils;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.jpa.domain.Specification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utility class for creating dynamic JPA Specifications from DataFilters.
 * This class provides a generic method that can be used for any entity type.
 */
public class SpecificationUtil {

    private static final Logger logger = LoggerFactory.getLogger(SpecificationUtil.class);
    private static final String DATE_FORMAT = "yyyy-MM-dd";
    private static final String DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";

    /**
     * Creates a generic {@link Specification} from a list of {@link DataFilter} to build dynamic queries.
     * This method supports various filtering types based on the provided filterType map.
     *
     * @param dataFilter list of filters to apply.
     * @param filterType a map defining the data type and filter type for each field.
     * @param <T> The entity type to be filtered.
     * @return a Specification object representing the combined filters.
     */
    public static <T> Specification<T> createSpecificationFromFilter(List<DataFilter> dataFilter, Map<String, Map<String, String>> filterType) {
        if (dataFilter == null || dataFilter.isEmpty() || filterType == null) {
            return null;
        }

        Specification<T> spec = Specification.where(null);

        for (DataFilter filter : dataFilter) {
            String fieldName = filter.getFieldName();
            String fieldValue = filter.getFieldValue();

            if (fieldName != null && fieldValue != null) {
                Map<String, String> fieldInfo = filterType.get(fieldName);

                if (fieldInfo != null) {
                    String dataType = fieldInfo.get("dataType");
                    String filterOperation = fieldInfo.get("filterType");

                    if (Objects.equals(filterOperation, "exact")) {
                        switch (dataType) {
                            case "Long":
                                spec = spec.and((root, query, criteriaBuilder) ->
                                    criteriaBuilder.equal(root.get(fieldName), Long.parseLong(fieldValue))
                                );
                                break;
                            case "Integer":
                                spec = spec.and((root, query, criteriaBuilder) ->
                                    criteriaBuilder.equal(root.get(fieldName), Integer.parseInt(fieldValue))
                                );
                                break;
                            case "Double":
                            case "Float":
                                spec = spec.and((root, query, criteriaBuilder) ->
                                    criteriaBuilder.equal(root.get(fieldName), Double.parseDouble(fieldValue))
                                );
                                break;
                            case "Boolean":
                                spec = spec.and((root, query, criteriaBuilder) ->
                                    criteriaBuilder.equal(root.get(fieldName), Boolean.parseBoolean(fieldValue))
                                );
                                break;
                            case "Date":
                                spec = spec.and((root, query, criteriaBuilder) -> {
                                    try {
                                        Date date = new SimpleDateFormat(DATE_FORMAT).parse(fieldValue);
                                        return criteriaBuilder.equal(root.<Date>get(fieldName), date);
                                    } catch (ParseException e) {
                                        logger.error("Error parsing date for field {}: {}", fieldName, e.getMessage());
                                        return criteriaBuilder.disjunction(); // Return a false predicate
                                    }
                                });
                                break;
                            case "DateTime":
                                spec = spec.and((root, query, criteriaBuilder) -> {
                                    try {
                                        Date dateTime = new SimpleDateFormat(DATETIME_FORMAT).parse(fieldValue);
                                        return criteriaBuilder.equal(root.<Date>get(fieldName), dateTime);
                                    } catch (ParseException e) {
                                        logger.error("Error parsing datetime for field {}: {}", fieldName, e.getMessage());
                                        return criteriaBuilder.disjunction(); // Return a false predicate
                                    }
                                });
                                break;
                            case "String":
                                spec = spec.and((root, query, criteriaBuilder) ->
                                    criteriaBuilder.equal(root.get(fieldName), fieldValue)
                                );
                                break;
                            default:
                                // Handle unsupported data types, e.g., log a warning
                                break;
                        }
                    } else if (Objects.equals(filterOperation, "partial")) {
                        if (Objects.equals(dataType, "String")) {
                            spec = spec.and((root, query, criteriaBuilder) ->
                                criteriaBuilder.like(criteriaBuilder.lower(root.get(fieldName)), "%" + fieldValue.toLowerCase() + "%")
                            );
                        }
                    }
                }
            }
        }
        return spec;
    }
}
`;
        return [{ 
            name: this.createSourceDirectoryFromArtefact(this.packageName) + `utils/SpecificationUtil.java`,
            content: content 
        }];
    }
    
    generateDataFilterFile()
    {
        const content = `package ${this.packageName}.utils;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class DataFilter {
	String fieldName;
	String fieldValue;
}
`;
        return [{ 
            name: this.createSourceDirectoryFromArtefact(this.packageName) + `utils/DataFilter.java`,
            content: content 
        }];
    }
    
    generateDataOrderFile()
    {
        const content = `package ${this.packageName}.utils;

import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class DataOrder {
	String fieldName;
	String orderType;
}
`;
        return [{ 
            name: this.createSourceDirectoryFromArtefact(this.packageName) + `utils/DataOrder.java`,
            content: content 
        }];
    }

    /**
     * Recursively find nested ManyToOne relations up to a certain depth,
     * including those from composite primary keys.
     */
    getNestedRelations(entities, entity, prefix = "", depth = 2) {
        if (depth <= 0) return [];

        let relations = [];
        let isCompositeKey = this.getPrimaryKeys(entity).length > 1;
        
        // Periksa kolom di entitas utama
        entity.columns.forEach(col => {
            if (this.isForeignKey(entities, entity, col) && !isCompositeKey) {
                let relationName = stringUtil.camelize(col.name.replace(/_id$/i, ""));
                let fullPath = prefix ? `${prefix}.${relationName}` : relationName;
                relations.push(fullPath);

                let targetEntity = entities.find(e => e.name.toLowerCase() === relationName.toLowerCase());
                if (targetEntity) {
                    relations.push(...this.getNestedRelations(entities, targetEntity, fullPath, depth - 1));
                }
            }
        });

        
        entity.columns.forEach(col => {
            if (isCompositeKey) {
                let relationName = stringUtil.camelize(col.name.replace(/_id$/i, ""));
                let fullPath = prefix ? `${prefix}.${relationName}` : relationName;
                relations.push(fullPath);

                let targetEntity = entities.find(e => e.name.toLowerCase() === relationName.toLowerCase());
                if (targetEntity) {
                    relations.push(...this.getNestedRelations(entities, targetEntity, fullPath, depth - 1));
                }
            }
        });


        return relations;
    }

    /**
     * Generates repository files for all entities in the model.
     * Adds @EntityGraph for fetching ManyToOne relationships (nested).
     * Creates normal repository and Input repository.
     */
    generateConnectionFiles() {
        let entities = this.model.entities;
        let file = [];
        entities.forEach(entity => {
            let entityNameCamel = stringUtil.camelize(entity.name);
            let upperCamelEntityName = stringUtil.upperCamel(entityNameCamel);


                // === 1. Main repository ===
                let repositoryContent = `package ${this.packageName}.output;

import org.springframework.data.domain.Page;

import ${this.packageName}.entity.${upperCamelEntityName};
import ${this.packageName}.utils.PageInfo;

/**
 * A connection wrapper for paginated {@link ${upperCamelEntityName}} results.
 * <p>
 * This class encapsulates both the paginated list of {@link ${upperCamelEntityName}} entities
 * and pagination metadata via {@link PageInfo}.
 * It is commonly used as a GraphQL-compatible representation of
 * paginated query results.
 * </p>
 */
public class ${upperCamelEntityName}Connection
{
    /**
     * Pagination metadata, including total records, total pages,
     * current page number, and page size.
     */
    private PageInfo pageInfo;

    /**
     * The underlying paginated data of {@link ${upperCamelEntityName}} entities.
     */
    private Page<${upperCamelEntityName}> data;

    /**
     * Constructs a new {@code ${upperCamelEntityName}Connection} from a Spring Data {@link Page}.
     * <p>
     * The {@link PageInfo} is initialized from the provided {@link Page}
     * to represent pagination details.
     * </p>
     *
     * @param page the {@link Page} of {@link ${upperCamelEntityName}} entities to wrap.
     */
    public ${upperCamelEntityName}Connection(Page<${upperCamelEntityName}> page)
    {
        this.data = page;
        this.pageInfo = new PageInfo(page);
    }
}

`;
            file.push({
                name: this.createSourceDirectoryFromArtefact(this.packageName) + `output/${upperCamelEntityName}Connection.java`,
                content: repositoryContent
            });
        });
        return file;
    }

    /**
     * Generates repository files for all entities in the model.
     * Adds @EntityGraph for fetching ManyToOne relationships (nested).
     * Creates normal repository and Input repository.
     */
    generateRepositoryFiles() {
        let entities = this.model.entities;
        let file = [];
        let _this = this;

        entities.forEach(entity => {
            let entityNameCamel = stringUtil.camelize(entity.name);
            let upperCamelEntityName = stringUtil.upperCamel(entityNameCamel);
            let primaryKeys = this.getPrimaryKeys(entity);

            if (primaryKeys.length > 0) {
                let pkType = primaryKeys.length > 1
                    ? `${upperCamelEntityName}Id`
                    : this.getJavaType(primaryKeys[0].type);

                let methodNameSuffix = primaryKeys.map(pk => stringUtil.upperCamel(stringUtil.camelize(pk.name))).join('And');
                let paramList = primaryKeys.map(pk => `${this.getJavaType(pk.type)} ${stringUtil.camelize(pk.name)}`).join(', ');

                let javaLangTypes = ["String", "Long", "Integer", "Double", "Float", "Boolean", "Character", "Byte", "Short"];
                let pkTypeImport = "";
                if (!javaLangTypes.includes(pkType) && !pkType.includes(".")) {
                    pkTypeImport = `import ${this.packageName}.entity.${pkType};\n`;
                }

                // Get nested relations for EntityGraph annotation
                // Adjusted to use 3 as the depth limit
                // to prevent excessive recursion and large queries
                // This will include relations from composite primary keys as well
                let relations = this.getNestedRelations(entities, entity, "", _this.maxRelationDepth || 3);

                let entityGraphAnnotation = "";
                if (relations.length > 0 || (primaryKeys.length > 1)) {
                    entityGraphAnnotation = `    @EntityGraph(attributePaths = { ${relations.map(r => `"${r}"`).join(', ')} })\n`; // NOSONAR
                }

                // === 1. Main repository ===
                let repositoryContent = `package ${this.packageName}.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
${relations.length > 0 ? 'import org.springframework.data.jpa.repository.EntityGraph;\n' : ''}
import ${this.packageName}.entity.${upperCamelEntityName};
${pkTypeImport}
/**
 * Repository interface for {@link ${upperCamelEntityName}} entity.
 * <p>Provides basic CRUD operations and custom queries.</p>
 */
@Repository
public interface ${upperCamelEntityName}Repository extends JpaRepository<${upperCamelEntityName}, ${pkType}> {

${entityGraphAnnotation}    ${upperCamelEntityName} findOneBy${methodNameSuffix}(${paramList});

${entityGraphAnnotation}    Page<${upperCamelEntityName}> findAll(Specification<${upperCamelEntityName}> specification, Pageable pageable);
}
`;
            file.push({
                name: this.createSourceDirectoryFromArtefact(this.packageName) + `repository/${upperCamelEntityName}Repository.java`,
                content: repositoryContent
            });

            // === 2. Input repository ===
            let inputRepositoryContent = `package ${this.packageName}.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ${this.packageName}.entity.${upperCamelEntityName}Input;
${pkTypeImport}
/**
 * Repository interface for {@link ${upperCamelEntityName}Input} entity.
 * <p>Provides basic CRUD operations and custom queries for input version.</p>
 */
@Repository
public interface ${upperCamelEntityName}InputRepository extends JpaRepository<${upperCamelEntityName}Input, ${pkType}> {

    ${upperCamelEntityName}Input findOneBy${methodNameSuffix}(${paramList});

    void deleteBy${methodNameSuffix}(${paramList});
}
`;
                file.push({
                    name: this.createSourceDirectoryFromArtefact(this.packageName) + `repository/${upperCamelEntityName}InputRepository.java`,
                    content: inputRepositoryContent
                });
            }
        });
        return file;
    }






    generateEntityFiles() {
        let _this = this;
        let entities = this.model.entities;
        let file = [];

        entities.forEach(entity => {
            let entityName = entity.name;
            let upperCamelEntityName = stringUtil.upperCamel(stringUtil.camelize(entityName));
            let entityNameSnake = stringUtil.snakeize(entityName);
            let primaryKeys = this.getPrimaryKeys(entity);

            // === 1. Main entity ===
            let entityContent = `package ${this.packageName}.entity;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PostLoad;
import jakarta.persistence.Table;

import lombok.Setter;
import lombok.Getter;

/**
 * Entity class representing the ${upperCamelEntityName} table in the database.
 * 
 * <p>This class is automatically generated by GraphQL Generator.</p>
 * <p>Contains fields for each column in the table, with appropriate annotations for JPA.</p>
 */
@Entity
@Table(name = "${entityNameSnake}")
@Setter
@Getter
`;
        if (primaryKeys.length > 1) {
            entityContent += `@IdClass(${upperCamelEntityName}Id.class)
`;
        }

        entityContent += `public class ${upperCamelEntityName} {

`;

        let relationProps = []; // save the property of the relation

        entity.columns.forEach(column => {
            let columnName = column.name;
            let columnCamelName = stringUtil.camelize(columnName);
            let columnType = column.type;
            let columnJavaType = this.getJavaType(columnType);
            let objectName = columnCamelName.substring(0, columnCamelName.length - 2);
            let objectType = stringUtil.upperCamel(objectName);

            if (column.primaryKey) {
                entityContent += `    @Id
`;
                if (column.autoIncrement) {
                    entityContent += `    @GeneratedValue(strategy = GenerationType.IDENTITY)
`;
                }
            }

            if (_this.isForeignKey(_this.model.entities, entity, column)) {
                
                entityContent += `    @Column(name = "${columnName}")
    private ${columnJavaType} ${columnCamelName};

`;
                
                let fk = `@ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "${column.name}", referencedColumnName = "${column.name}", insertable=false, updatable=false)
    private ${objectType} ${objectName}`;
                entityContent += `    ${fk};

`;
                relationProps.push({ name: objectName, type: objectType });
            } else {
                entityContent += `    @Column(name = "${columnName}")
    private ${columnJavaType} ${columnCamelName};

`;
            }
            
            
            if(primaryKeys.length > 1)
            {

                if (column.primaryKey && !column.autoIncrement) {
                    entityContent += `    @ManyToOne
    @JoinColumn(name = "${columnName}", referencedColumnName = "${columnName}", insertable = false, updatable = false)
    private ${objectType} ${objectName};

`;
                    
                
               
                }
            }
            
        });

        if (relationProps.length > 0) {
            entityContent += `
    @PostLoad
    public void initRelationsIfNull() {
`;
            relationProps.forEach(rel => {
                entityContent += `        if (this.${rel.name} == null) {
            this.${rel.name} = new ${rel.type}();
        }
`;
            });
            entityContent += `    }
`;
        }

        entityContent += `}
`;
        file.push({
            name: this.createSourceDirectoryFromArtefact(this.packageName) + `entity/${upperCamelEntityName}.java`,
            content: entityContent
        });

        // === 2. Input entity === (without relation)
        let entityInputContent = `package ${this.packageName}.entity;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import lombok.Setter;
import lombok.Getter;

/**
 * Entity class representing the ${upperCamelEntityName} table in the database.
 * 
 * <p>This class is automatically generated by GraphQL Generator.</p>
 * <p>Contains fields for each column in the table, with appropriate annotations for JPA.</p>
 */
@Entity
@Table(name = "${entityNameSnake}")
@Setter
@Getter
`;
        if (primaryKeys.length > 1) {
            entityInputContent += `@IdClass(${upperCamelEntityName}Id.class)
`;
        }

        entityInputContent += `public class ${upperCamelEntityName}Input {

`;

        entity.columns.forEach(column => {
            let columnName = column.name;
            let columnCamelName = stringUtil.camelize(columnName);
            let columnType = column.type;
            let columnJavaType = this.getJavaType(columnType);

            if (column.primaryKey) {
                entityInputContent += `    @Id
`;
                if (column.autoIncrement) {
                    entityInputContent += `    @GeneratedValue(strategy = GenerationType.IDENTITY)
`;
                }
            }

            // Semua kolom di Input versi column biasa
            entityInputContent += `    @Column(name = "${columnName}")
    private ${columnJavaType} ${columnCamelName};

`;
        });

        entityInputContent += `}
`;

            file.push({
                name: this.createSourceDirectoryFromArtefact(this.packageName) + `entity/${upperCamelEntityName}Input.java`,
                content: entityInputContent
            });

        });

        return file;
    }
    
    generateFetchPropertiesFile()
    {
        const content = `package ${this.packageName}.utils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import lombok.Getter;
import lombok.Setter;

/**
 * A utility class to manage and filter properties for data fetching operations.
 * It stores configurations for filtering and ordering fields, and provides
 * methods to ensure that requested fields are valid and supported.
 */
@Getter
@Setter
public class FetchProperties {
	
	private Map<String, Map<String, String>> filter;
	private List<Map<String, String>> order;
	
	public FetchProperties()
	{
		this.filter = new HashMap<>();
		this.order = new ArrayList<>();
	}

	/**
	 * Adds a field to the filter configuration.
	 *
	 * @param key The unique key for the filter (e.g., a field name).
	 * @param fieldName The actual name of the field in the entity.
	 * @param dataType The data type of the field (e.g., "String", "Long").
	 * @param filterType The type of filter operation (e.g., "exact", "partial").
	 */
	public void add(String key, String fieldName, String dataType, String filterType) {
		this.filter.put(key, this.createFilterType(fieldName, dataType, filterType));
	}

	/**
	 * Creates a map representing a single filter type configuration.
	 *
	 * @param fieldName The name of the field.
	 * @param dataType The data type of the field.
	 * @param filterType The filter operation type.
	 * @return A map containing the filter properties.
	 */
	private Map<String, String> createFilterType(String fieldName, String dataType, String filterType) {
		Map<String, String> field = new HashMap<>();
		
		field.put("fieldName", fieldName);
		field.put("dataType", dataType);
		field.put("filterType", filterType);
		
		return field;
	}

	/**
	 * Filters a list of data orders to include only those fields that are
	 * configured for filtering in this utility.
	 *
	 * @param dataOrder The list of data orders to filter.
	 * @return A new list containing only the valid data orders.
	 */
	public List<DataOrder> filterFieldName(List<DataOrder> dataOrder) {
		if(dataOrder == null)
		{
			return dataOrder;
		}
		List<DataOrder> result = new ArrayList<>();
		for(DataOrder item : dataOrder)
		{
			if(this.inList(item))
			{
				result.add(item);
			}
		}
		
		return result;
	}
	
	/**
	 * Checks if a given data order field is present in the configured filter list.
	 *
	 * @param order The DataOrder object to check.
	 * @return {@code true} if the field is in the filter list, {@code false} otherwise.
	 */
	public boolean inList(DataOrder order)
	{
		for(Entry<String, Map<String, String>> entry : this.filter.entrySet())
		{
			if(entry.getValue().getOrDefault("fieldName", "").equals(order.getFieldName()))
			{
				return true;
			}
		}
		return false;
	}
}
`;
        return [{ 
            name: this.createSourceDirectoryFromArtefact(this.packageName) + `utils/FetchProperties.java`,
            content: content 
        }];
    }
    
    generatePageUtilFile()
    {
        const content = `package ${this.packageName}.utils;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.domain.Sort.Order;
import java.util.List;
import java.util.ArrayList;
import java.util.Objects;

public class PageUtil {

    /**
     * Creates a Pageable object for paginated and sorted queries.
     *
     * @param pageNumber The 1-based page number. Defaults to 1 if null or less than 1.
     * @param pageSize The number of items per page. Defaults to 20, min is 1.
     * @param sortFields A list of maps, with each map containing "fieldName" and "sortType".
     * @param orderByFields An array of field names to sort by. Defaults to ascending.
     * @return A Pageable object configured with pagination and sorting.
     */
    public static Pageable pageRequest(Integer pageNumber, Integer pageSize, List<DataOrder> sortFields, String... orderByFields) {
        // Handle page number: convert to 0-based and ensure it's not negative.
        int currentPage = (pageNumber != null && pageNumber > 0) ? pageNumber - 1 : 0;
        
        // Handle page size: ensure it's at least 1.
        int rowPerPage = (pageSize != null && pageSize > 0) ? pageSize : 20;
        
        Sort sort = createSortFromList(sortFields);

        if (sort.isUnsorted() && orderByFields != null && orderByFields.length > 0) {
            sort = Sort.by(Direction.ASC, orderByFields);
        }
        
        return PageRequest.of(currentPage, rowPerPage, sort);
    }
    
    /**
     * Creates a {@link Sort} object from a list of maps, where each map
     * specifies a field to sort by and the sort direction.
     *
     * @param sortFields A list of maps, with each map containing "fieldName" and "sortType" (e.g., "asc" or "desc").
     * @return a Sort object representing the combined sorting criteria.
     */
    public static Sort createSortFromList(List<DataOrder> sortFields) {
        if (sortFields == null || sortFields.isEmpty()) {
            // Return unsorted object if no fields are provided
            return Sort.unsorted();
        }

        List<Order> orders = new ArrayList<>();
        for (DataOrder field : sortFields) {
            String fieldName = field.getFieldName();
            String orderTypeType = field.getOrderType();
            if(orderTypeType == null)
            {
            	orderTypeType = "asc";
            }

            if (fieldName != null && orderTypeType != null) {
                // Default direction is ASC
                Direction direction = Direction.ASC;
                if (Objects.equals(orderTypeType.toLowerCase(), "desc")) {
                    direction = Direction.DESC;
                }
                orders.add(new Order(direction, fieldName));
            }
        }
        
        // If the list of orders is empty after processing, return unsorted
        if (orders.isEmpty()) {
            return Sort.unsorted();
        }

        return Sort.by(orders);
    }


}
`;
        return [{ 
            name: this.createSourceDirectoryFromArtefact(this.packageName) + `utils/PageUtil.java`,
            content: content 
        }];
    }

    
    /**
     * Memeriksa apakah sebuah kolom adalah kunci asing dengan mencari kunci primer yang cocok
     * di entitas lain.
     * @param {Array<Object>} modelEntities - Daftar semua entitas dalam model.
     * @param {Object} entityToCheck - Entitas tempat kolom berada.
     * @param {Object} columnToCheck - Kolom yang akan diperiksa.
     * @returns {boolean} True jika kolom adalah kunci asing, false sebaliknya.
     */
    isForeignKey(modelEntities, entityToCheck, columnToCheck) {
        // Kolom tidak bisa menjadi foreign key untuk dirinya sendiri.
        if (columnToCheck.primaryKey) {
            return false;
        }
        

        // Iterasi melalui setiap entitas dalam model.
        for (const entity of modelEntities) {
            // Kita hanya perlu memeriksa entitas yang berbeda dari entitas yang sedang kita periksa.
            if (entity.name === entityToCheck.name) {
                continue;
            }
            

            // Dapatkan semua primary key dari entitas lain.
            const primaryKeys = this.getPrimaryKeys(entity);

            // Periksa apakah nama kolom yang kita cek cocok dengan nama salah satu primary key
            // di entitas lain.
            for (const pk of primaryKeys) {
                if (pk.name === columnToCheck.name) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Generates ID class files for entities with composite primary keys.
     * @returns {Array} Array of ID class file objects.
     */
    generateIdClassFiles() {
        let files = [];
        
        
        
        this.model.entities.forEach(entity => {
            let primaryKeys = this.getPrimaryKeys(entity);
            if (primaryKeys.length > 1) {
                let idClassName = `${stringUtil.upperCamel(stringUtil.camelize(entity.name))}Id`;
                let content = `package ${this.packageName}.entity;

import java.io.Serializable;
import java.util.Objects;
import jakarta.persistence.Embeddable;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;

import lombok.Setter;
import lombok.Getter;

@Embeddable
@Setter
@Getter
public class ${idClassName} implements Serializable {

`;
                primaryKeys.forEach(pk => {
                    let pkNameCamel = stringUtil.camelize(pk.name);
                    let pkJavaType = this.getJavaType(pk.type);
                    
                    
                    if (pk.primaryKey) {
                        content += ``;
                        if (pk.autoIncrement) {
                            content += `    @GeneratedValue(strategy = GenerationType.IDENTITY)
`;
                        }
                    }

                    content += `    private ${pkJavaType} ${pkNameCamel};

`;
                    
                });
                

                content += `    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ${idClassName} that = (${idClassName}) o;
        return ${primaryKeys.map(pk => `Objects.equals(${stringUtil.camelize(pk.name)}, that.${stringUtil.camelize(pk.name)})`).join(' && ')};
    }

    @Override
    public int hashCode() {
        return Objects.hash(${primaryKeys.map(pk => stringUtil.camelize(pk.name)).join(', ')});
    }

`;
                
                
                content += `}
`;
                files.push({ name: this.createSourceDirectoryFromArtefact(this.packageName) + `entity/${idClassName}.java`, content: content });
            }
        });
        return files;
    }

    /**
     * Generates the GraphQL schema file from the model entities.
     * @returns {Array} Array containing the GraphQL schema file object.
     */
    generateGraphQlSchema() {
        let content = util.buildGraphQLSchema(this.model.entities, false);
        return [{ name: "src/main/resources/graphql/schema.graphqls", content: content }];
    }

    generatePageInfoFile()
    {
        const content = `package ${this.packageName}.utils;

import lombok.Getter;
import lombok.Setter;

import org.springframework.data.domain.Page;

@Setter
@Getter
public class PageInfo {
	Integer totalCount;
    Integer totalPages;
    Integer currentPage;
    Integer pageSize;
    Boolean hasNextPage; 
    Boolean hasPreviousPage;

	public PageInfo(Page<?> page)
	{
		this.totalCount = page.getNumberOfElements();
		this.totalPages = page.getTotalPages();
		this.currentPage = page.getNumber() + 1;
		this.pageSize = page.getSize();
		this.hasNextPage = page.hasNext();
		this.hasPreviousPage = page.hasPrevious();
	}
}



`;      return [{ 
            name: this.createSourceDirectoryFromArtefact(this.packageName) + `utils/PageInfo.java`,
            content: content 
        }];
    }

    /**
     * Generates the Maven pom.xml file for the project.
     * @returns {Array} Array containing the pom.xml file object.
     */
    generatePomFile() {
        const config = {
            groupId: this.groupId,
            artifactId: this.artifactId,
            version: this.version,
            name: this.serviceName,
            description: this.serviceDescription,
            javaVersion: this.javaVersion,
            packageName: this.packageName
        };
        const pomXmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
<modelVersion>4.0.0</modelVersion>
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.4</version>
    <relativePath/> <!-- lookup parent from repository -->
</parent>
<groupId>${config.groupId}</groupId>
<artifactId>${config.artifactId}</artifactId>
<version>${config.version}</version>
<name>${config.name}</name>
<description>${config.description}</description>
<url/>
<licenses>
    <license/>
</licenses>
<developers>
    <developer/>
</developers>
<scm>
    <connection/>
    <developerConnection/>
    <tag/>
    <url/>
</scm>
<properties>
    <java.version>${config.javaVersion}</java.version>
</properties>
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-graphql</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webflux</artifactId>
    </dependency>

    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>io.projectreactor</groupId>
        <artifactId>reactor-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>

<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <configuration>
                <annotationProcessorPaths>
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </path>
                </annotationProcessorPaths>
            </configuration>
        </plugin>
        <plugin>
            <groupId>io.github.deweyjose</groupId>
            <artifactId>graphqlcodegen-maven-plugin</artifactId>
            <version>1.61.5</version>
            <executions>
                <execution>
                    <id>dgs-codegen</id>
                    <goals>
                        <goal>generate</goal>
                    </goals>
                    <configuration>
                        <schemaPaths>
                            <param>src/main/resources/graphql</param>
                        </schemaPaths>
                        <packageName>${config.packageName}.codegen</packageName>
                        <addGeneratedAnnotation>true</addGeneratedAnnotation>
                        <disableDatesInGeneratedAnnotation>true</disableDatesInGeneratedAnnotation>
                    </configuration>
                </execution>
            </executions>
        </plugin>
        <plugin>
            <groupId>org.codehaus.mojo</groupId>
            <artifactId>build-helper-maven-plugin</artifactId>
            <executions>
                <execution>
                    <id>add-dgs-source</id>
                    <phase>generate-sources</phase>
                    <goals>
                        <goal>add-source</goal>
                    </goals>
                    <configuration>
                        <sources>
                            <source>`+'${project.build.directory}'+`/generated-sources</source>
                        </sources>
                    </configuration>
                </execution>
            </executions>
        </plugin>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <excludes>
                    <exclude>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </exclude>
                </excludes>
            </configuration>
        </plugin>
    </plugins>
</build>

</project>
`;
        return [{ name: "pom.xml", content: pomXmlContent }];
    }
    
    
    
    
    
    
    
    /**
     * Converts a given SQL data type string to its equivalent Java data type string.
     * This method handles common MySQL data types.
     *
     * @param sqlType The SQL data type as a string (e.g., "VARCHAR", "INT", "DATETIME").
     * @return The corresponding Java data type as a string (e.g., "String", "Integer", "Date").
     */
    getDataType(sqlType) {
        if (sqlType == null) {
            return "String"; // Default to String for null input
        }

        switch (sqlType.toUpperCase()) {
            case "CHAR":
            case "VARCHAR":
            case "TEXT":
            case "LONGTEXT":
            case "MEDIUMTEXT":
                return "String";
            case "TINYINT":
            case "SMALLINT":
            case "MEDIUMINT":
            case "INT":
                return "Integer";
            case "BIGINT":
                return "Long";
            case "FLOAT":
                return "Float";
            case "DOUBLE":
            case "DECIMAL":
                return "Double";
            case "BOOLEAN":
                return "Boolean";
            case "DATE":
                return "Date";
            case "DATETIME":
            case "TIMESTAMP":
                return "DateTime";
            default:
                return "String"; // Default to String for any unknown types
        }
    }
    /**
     * Determines the appropriate default filter type based on a given Java data type.
     * For String types, it defaults to "partial" matching. For all other types, it defaults to "exact" matching.
     *
     * @param dataType The Java data type as a string (e.g., "String", "Integer", "Date").
     * @return The default filter type as a string ("partial" or "exact").
     */
    getFilterType(dataType)
    {
        if (dataType == null) {
            return "partial";
        }
        switch (dataType) // NOSONAR
        {
            case "String":
                return "partial";
            default:
                return "exact";
        }
    }
}