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
        files.push(...this.generateServiceFiles());
        files.push(...this.generateControllerFiles());
        files.push(...this.generateGraphQlSchema());
        files.push(...this.generatePomFile());
        files.push(...this.generateApplicationFile());
        
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
     * Converts a string to camelCase format.
     * @param {string} str - The input string.
     * @returns {string} The camelCase formatted string.
     */
    camelize(str) {
        const normalized = str.replace(/[^a-zA-Z0-9 ]/g, ' ').toLowerCase();
        return normalized.split(' ').map((word, index) => {
            if (index === 0) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join('');
    }

    /**
     * Converts a camelCase string to UpperCamelCase (PascalCase).
     * @param {string} camelCaseStr - The camelCase string.
     * @returns {string} The UpperCamelCase formatted string.
     */
    upperCamel(camelCaseStr) {
        return camelCaseStr
            .replace(/([A-Z])/g, '$1')
            .replace(/^./, str => str.toUpperCase());
    }

    /**
     * Converts a string to snake_case format.
     * @param {string} header - The input string.
     * @returns {string} The snake_case formatted string.
     */
    snakeize(header) {
        let ucwords = header
            .replace(/[_\-]+/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[^a-zA-Z0-9 ]+/g, '')
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase());
        let name = ucwords
            .replace(/\s+/g, "_")
            .toLowerCase()
            .replace(/^_+|_+$/g, "")
            .replace(/__+/g, "_");
        return name;
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
                primaryKeyCamel: this.camelize(pk.name),
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
    

    /**
     * Generates controller files for all entities in the model.
     * @returns {Array} Array of controller file objects.
     */
    generateControllerFiles() {
    let _this = this;
    let entities = this.model.entities;
    let file = [];
    entities.forEach(entity => {
        let entityName = entity.name;
        let entityNameCamel = this.camelize(entityName);
        let upperCamelEntityName = this.upperCamel(entityNameCamel);
        let primaryKeys = this.getPrimaryKeys(entity);

        if (primaryKeys.length > 0) {
            let paramList = primaryKeys.map(pk => `@Argument ${this.getJavaType(pk.type)} ${this.camelize(pk.name)}`).join(', ');
            let callParams = primaryKeys.map(pk => this.camelize(pk.name)).join(', ');
            let methodNameSuffix = primaryKeys.map(pk => this.upperCamel(this.camelize(pk.name))).join('And');
            

            let controllerContent = `package ${this.packageName}.controller;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.stereotype.Controller;
import ${this.packageName}.utils.DataFilter;
import ${this.packageName}.utils.DataOrder;
import ${this.packageName}.entity.${upperCamelEntityName};
import ${this.packageName}.entity.${upperCamelEntityName}Input;
import ${this.packageName}.service.${upperCamelEntityName}Service;

import lombok.RequiredArgsConstructor;

@Controller
@RequiredArgsConstructor
public class ${upperCamelEntityName}Controller {

    private final ${upperCamelEntityName}Service ${entityNameCamel}Service;

    @QueryMapping
    public Page<${upperCamelEntityName}> get${upperCamelEntityName}s(@Argument(name = "pageNumber") Integer pageNumber, @Argument(name = "pageSize") Integer pageSize, @Argument(name = "dataFilter") List<DataFilter> dataFilter, @Argument(name = "dataOrder") List<DataOrder> dataOrder) {
        return ${entityNameCamel}Service.get${upperCamelEntityName}s(pageNumber, pageSize, dataFilter, dataOrder);
    }

    @QueryMapping
    public ${upperCamelEntityName} get${upperCamelEntityName}(${paramList}) {
        return ${entityNameCamel}Service.get${upperCamelEntityName}(${callParams});
    }

    @MutationMapping
    public ${upperCamelEntityName} create${upperCamelEntityName}(@Argument ${upperCamelEntityName}Input input) {
        return ${entityNameCamel}Service.create${upperCamelEntityName}(input);
    }

    @MutationMapping
    public ${upperCamelEntityName} update${upperCamelEntityName}(@Argument ${upperCamelEntityName}Input input) {
        return ${entityNameCamel}Service.update${upperCamelEntityName}(input);
    }

    @MutationMapping
    public Boolean delete${upperCamelEntityName}(${paramList}) {
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
            let entityNameCamel = this.camelize(entityName);
            let upperCamelEntityName = this.upperCamel(entityNameCamel);
            let primaryKeys = this.getPrimaryKeys(entity);
            
            let initFilter = '';
            
            entity.columns.forEach(column => {
                let dataType = _this.getDataType(column.type);
                let filterType = _this.getFilterType(dataType);
                let columnName = _this.camelize(column.name);
                initFilter += `\t\tthis.fetchProperties.add("${columnName}", "${columnName}", "${dataType}", "${filterType}");\r\n`
            });

            if (primaryKeys.length > 0) {
                let paramList = primaryKeys.map(pk => `${this.getJavaType(pk.type)} ${this.camelize(pk.name)}`).join(', ');
                let callParams = primaryKeys.map(pk => this.camelize(pk.name)).join(', ');
                let callParamNames = '"'+primaryKeys.map(pk => this.camelize(pk.name)).join('", "')+'"';
                let methodNameSuffix = primaryKeys.map(pk => this.upperCamel(this.camelize(pk.name))).join('And');
                
                let vals = [];
                primaryKeys.forEach(col => {
                    let upperColumnName = _this.upperCamel(_this.camelize(col.name));
                    vals.push(`input.get${upperColumnName}() == null`);
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
     * Retrieves a paginated and filtered list of all {@link ${upperCamelEntityName}} records from the database.
     * This method supports dynamic filtering and ordering based on provided criteria.
     *
     * @param pageNumber The 1-based page number for pagination.
     * @param pageSize The number of records to retrieve per page.
     * @param dataFilter A list of filters to be applied to the query.
     * @param dataOrder A list of fields and their sort order to be applied to the query.
     * @return A {@link Page} object containing the ${upperCamelEntityName} entities that match the criteria.
     */
    public Page<${upperCamelEntityName}> get${upperCamelEntityName}s(Integer pageNumber, Integer pageSize, List<DataFilter> dataFilter, List<DataOrder> dataOrder) {
    	List<DataOrder> filteredDataOrder = this.fetchProperties.filterFieldName(dataOrder);
        return ${entityNameCamel}Repository.findAll(
        		SpecificationUtil.createSpecificationFromFilter(dataFilter, this.fetchProperties.getFilter()), 
        		PageUtil.pageRequest(pageNumber, pageSize, filteredDataOrder, ${callParamNames})
        );
    }

    /**
     * Retrieves ${upperCamelEntityName} record matching the given primary key.
     *
     * @param ${primaryKeys.map(pk => this.camelize(pk.name)).join(', ')} the primary key value(s) used for filtering.
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
    public ${upperCamelEntityName} create${upperCamelEntityName}(${upperCamelEntityName}Input input) {
        ${upperCamelEntityName}Input saved = ${entityNameCamel}InputRepository.save(input);
        return ${entityNameCamel}Repository.findOneBy${methodNameSuffix}(
            ${primaryKeys.map(pk => `saved.get${this.upperCamel(this.camelize(pk.name))}()`).join(', ')}
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
            ${primaryKeys.map(pk => `saved.get${this.upperCamel(this.camelize(pk.name))}()`).join(', ')}
        );
    }

    /**
     * Deletes the {@link ${upperCamelEntityName}} record that matches the given primary key(s).
     *
     * @param ${primaryKeys.map(pk => this.camelize(pk.name)).join(', ')} the primary key value(s) of the record to delete.
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
                let relationName = this.camelize(col.name.replace(/_id$/i, ""));
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
                let relationName = this.camelize(col.name.replace(/_id$/i, ""));
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
    generateRepositoryFiles() {
        let entities = this.model.entities;
        let file = [];
        let _this = this;

        entities.forEach(entity => {
            let entityNameCamel = this.camelize(entity.name);
            let upperCamelEntityName = this.upperCamel(entityNameCamel);
            let primaryKeys = this.getPrimaryKeys(entity);

            if (primaryKeys.length > 0) {
                let pkType = primaryKeys.length > 1
                    ? `${upperCamelEntityName}Id`
                    : this.getJavaType(primaryKeys[0].type);

                let methodNameSuffix = primaryKeys.map(pk => this.upperCamel(this.camelize(pk.name))).join('And');
                let paramList = primaryKeys.map(pk => `${this.getJavaType(pk.type)} ${this.camelize(pk.name)}`).join(', ');

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
                    entityGraphAnnotation = `    @EntityGraph(attributePaths = { ${relations.map(r => `"${r}"`).join(', ')} })\n`;
                }

                // === 1. Repository utama ===
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

            // === 2. Repository versi Input ===
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
            let upperCamelEntityName = this.upperCamel(this.camelize(entityName));
            let entityNameSnake = this.snakeize(entityName);
            let primaryKeys = this.getPrimaryKeys(entity);

            // === 1. Entity utama ===
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

        let relationProps = []; // simpan properti relasi

        entity.columns.forEach(column => {
            let columnName = column.name;
            let columnCamelName = this.camelize(columnName);
            let columnType = column.type;
            let columnJavaType = this.getJavaType(columnType);
            let objectName = columnCamelName.substring(0, columnCamelName.length - 2);
            let objectType = this.upperCamel(objectName);

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

        // === 2. Entity Input === (tanpa relasi)
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
            let columnCamelName = this.camelize(columnName);
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
		for(DataOrder order : dataOrder)
		{
			if(this.inList(order))
			{
				result.add(order);
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
                let idClassName = `${this.upperCamel(this.camelize(entity.name))}Id`;
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
                    let pkNameCamel = this.camelize(pk.name);
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
        return ${primaryKeys.map(pk => `Objects.equals(${this.camelize(pk.name)}, that.${this.camelize(pk.name)})`).join(' && ')};
    }

    @Override
    public int hashCode() {
        return Objects.hash(${primaryKeys.map(pk => this.camelize(pk.name)).join(', ')});
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
        let content = GraphQLSchemaUtils.buildGraphQLSchema(this.model.entities, false);
        return [{ name: "src/main/resources/graphql/schema.graphqls", content: content }];
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
     * Checks whether the given buffer starts with the standard SQLite file header.
     * SQLite database files begin with the following 16-byte header: "SQLite format 3\0".
     *
     * @param {Uint8Array} buffer - The byte buffer to check.
     * @returns {boolean} - Returns true if the buffer matches the SQLite header signature.
     */
    looksLikeSQLite(buffer) {
        const sqliteHeader = [
            0x53, 0x51, 0x4C, 0x69,
            0x74, 0x65, 0x20, 0x66,
            0x6F, 0x72, 0x6D, 0x61,
            0x74, 0x20, 0x33, 0x00
        ];
        return sqliteHeader.every((byte, i) => buffer[i] === byte);
    }
    
    
    /**
     * Imports a SQLite database file and extracts table structures and data using SQL.js.
     * Converts each table into an Entity with MySQL-compatible column definitions and populates its 'data' property.
     *
     * @param {File} file - The SQLite database file to import.
     * @param {Function} [callback] - Optional callback function to invoke after import is complete.
     * @returns {void}
     */
    importSQLite(file, callback) {
        if (!file) {
            return; // Exit if no file is selected
        }
        let _this = this;
        const reader = new FileReader(); // Create a FileReader object
        reader.onload = function (event) {
            const arrayBuffer = event.target.result; // Get file data as an ArrayBuffer
            const uint8Array = new Uint8Array(arrayBuffer); // Convert ArrayBuffer to Uint8Array

            // Initialize SQL.js and load the database
            initSqlJs({ locateFile: file => `wasm/sql-wasm.wasm` }).then(SQL => {
                _this.db = new SQL.Database(uint8Array); // Create a new database instance

                // Get the names of all tables in the database
                let res1 = _this.db.exec("SELECT name FROM sqlite_master WHERE type='table';");
                let importedEntities = [];
                res1[0].values.forEach((row, index) => {
                    const tableName = row[0]; // Extract table name
                    let entity = new Entity(_this.snakeize(tableName), index);

                    // --- Start: Add data import capability ---
                    let tableData = _this.db.exec(`SELECT * FROM ${tableName};`);
                    if (tableData.length > 0) {
                        // Assuming tableData[0].columns contains column names and tableData[0].values contains rows
                        const columns = tableData[0].columns;
                        const values = tableData[0].values;

                        entity.creationDate = (new Date()).getTime();
                        entity.modificationDate = entity.creationDate;
                        entity.creator = '{{userName}}'; // Replace with actual user name if available
                        entity.modifier = '{{userName}}'; // Replace with actual user name if available

                        // Map array of values to array of objects for easier access
                        entity.data = values.map(rowValues => /*NOSONAR*/ {
                            const rowObject = {};
                            columns.forEach((colName, colIndex) => {
                                const snakeKey = _this.snakeize(colName);
                                rowObject[snakeKey] = rowValues[colIndex];
                            });
                            return rowObject;
                        });
                    } else {
                        entity.setData(null); // If no data, initialize as null
                    }
                    // --- End: Add data import capability ---

                    let tableInfo = _this.db.exec(`PRAGMA table_info(${tableName});`); // Get table info
                    if (tableInfo.length > 0) {
                        tableInfo[0].values.forEach(columnInfo => /*NOSONAR*/{
                             
                            let isAutoIncrement = columnInfo[2].toUpperCase() == 'INTEGER' && columnInfo[5];
                            
                            const column = new Column(
                                _this.snakeize(columnInfo[1]), // The name of the column.
                                _this.toMySqlType(columnInfo[2]), // The SQL data type of the column (e.g., "VARCHAR", "INT", "ENUM").
                                _this.getColumnSize(columnInfo[2]), // The length or precision of the column (e.g., "255" for VARCHAR, or "10,2" for DECIMAL). Optional.
                                columnInfo[3] === 1, // Indicates whether the column allows NULL values.
                                columnInfo[4], // The default value assigned to the column. Optional.
                                columnInfo[5], // Specifies whether the column is a primary key.
                                isAutoIncrement, // Indicates if the column value auto-increments (typically used for numeric primary keys).
                                null, // Valid values for ENUM/SET types, or value range for numeric types (comma-separated). Optional.
                            );
                            // Add the column to the entity
                            entity.addColumn(column);
                        });
                        importedEntities.push(entity); // Add the entity to the imported entities
                    }
                });

                if (typeof callback === 'function') {
                    callback({entities: importedEntities}); // Execute callback with the updated entities
                }

            });
        };
        reader.readAsArrayBuffer(file); // Read the selected file
    }
    
    /**
     * Imports an SQL file, translates its content to MySQL-compatible syntax, parses the table structures and data,
     * and updates the entity editor with the parsed entities and rows.
     *
     * @param {File} file - The SQL file to be imported.
     * @param {Function} [callback] - Optional callback to execute after the import process is completed.
     * @returns {void}
     */
    importSQLQuery(file, callback) {
        let _this = this;
        const reader = new FileReader(); // Initialize FileReader to read the file contents

        reader.onload = function (e) {
            let contents = e.target.result; // Extract text content from the file

            try {
                const translator = new SQLConverter(); // Create an instance to handle SQL dialect conversion
                const translatedContents = translator.translate(contents, 'mysql').replace(/`/g, ''); // Translate and clean backticks

                const tableParser = new TableParser(translatedContents); // Parse translated SQL structure (CREATE TABLE)
                tableParser.parseData(contents); // Parse original SQL content (INSERT INTO) to extract row data

                const importedEntities = _this.createEntitiesFromSQL(tableParser.tableInfo); // Convert table structures into editor entities

                if (typeof callback === 'function') {
                    callback({entities: importedEntities}); // Invoke callback with updated entity list
                }

            } catch (err) {
                console.log("Error parsing SQL: " + err.message); // Log error if parsing fails
            }
        };

        reader.onerror = () => {
            
        };

        reader.readAsText(file); // Begin reading the file as plain text
    }
    
    /**
     * Creates an array of Entity instances from the given SQL table data.
     * 
     * This method takes in an array of tables, each containing information about table columns, and converts that 
     * data into Entity and Column objects. It then returns an array of the created entities.
     *
     * @param {Array} tables - An array of tables (each table being an object) with column data to convert into entities.
     * Each table should contain a `tableName` and a `columns` array where each column object contains metadata about the column (e.g., Field, Type, Length, Nullable, etc.).
     * 
     * @returns {Array} entities - An array of Entity objects, each containing Column objects based on the provided table data.
     */
    createEntitiesFromSQL(tables) {
        const entities = [];

        // Iterate over each entity in the JSON data
        tables.forEach((table, index) => {
            // Create a new Entity instance
            let entity = new Entity(table.tableName, index);
            
            // Iterate over each column in the entity's columns array
            table.columns.forEach(columnData => {
                // Create a new Column instance
                const column = new Column(
                    columnData.Field,
                    columnData.Type.toUpperCase(),
                    columnData.Length,
                    columnData.Nullable,
                    columnData.Default,
                    columnData.Key,
                    columnData.AutoIncrement,
                    (columnData.EnumValues != null && typeof columnData.EnumValues == 'object') ? columnData.EnumValues.join(', ') : null,
                    null
                );
                
                // Add the column to the entity
                entity.addColumn(column);
            });

            entity.creationDate = (new Date()).getTime();
            entity.modificationDate = entity.creationDate;
            entity.creator = '{{userName}}'; // Replace with actual user name if available
            entity.modifier = '{{userName}}'; // Replace with actual user name if available

            // Add the entity to the entities array
            entities.push(entity);
        });

        return entities;
    };
    
    
    /**
     * Imports an SQL file and processes its content.
     * 
     * This function accepts an SQL file, reads its contents as text using a FileReader, then parses it 
     * using a `TableParser` and updates the editor's entities with the parsed data. After the import, 
     * a callback function is invoked with the updated entities, if provided.
     * 
     * @param {File} file - The SQL file object to be imported.
     * @param {Function} [callback] - Optional callback function to be executed after the entities are updated. 
     *                                The callback will receive the updated entities as its argument.
     * @returns {void} - This function does not return a value.
     */
    importSQLFile(file, callback) {
        const _this = this;
        const reader = new FileReader();

        // Baca 512 byte pertama
        const blob = file.slice(0, 512);
        reader.onload = function (e) {
            const buffer = new Uint8Array(e.target.result);
            if (_this.looksLikeSQLite(buffer)) {
                _this.importSQLite(file, callback);
            } else {
                _this.importSQLQuery(file, callback);
            }
        };

        reader.onerror = () => {};
        reader.readAsArrayBuffer(blob);
    }
    
    /**
     * Converts SQLite data type to MySQL equivalent without length or default values.
     * The mapping is done in order of priority using a predefined list of patterns.
     * 
     * @param {string} sqliteType - The original SQLite column type.
     * @returns {string} - Corresponding MySQL data type.
     */
    toMySqlType(sqliteType) {
        if (!sqliteType) return 'TEXT';

        const type = sqliteType.trim().toUpperCase();

        // Ordered map of patterns to MySQL types
        const typeMap = [
            [/NVARCHAR/, "VARCHAR"],
            [/INT/, "BIGINT"],
            [/(CHAR|CLOB|TEXT)/, "TEXT"],
            [/BLOB/, "BLOB"],
            [/(REAL|FLOA|DOUB)/, "DOUBLE"],
            [/(NUMERIC|DECIMAL)/, "DECIMAL"],
            [/BOOLEAN/, "TINYINT"],
            [/TIMESTAMP/, "TIMESTAMP"],
            [/(DATE|TIME)/, "DATETIME"]
        ];

        for (const [pattern, mysqlType] of typeMap) {
            if (pattern.test(type)) {
                return mysqlType;
            }
        }

        return sqliteType; // Default fallback
    }
    
    /**
     * Extracts size/length value from a SQLite column type.
     * 
     * @param {string} sqliteType - The original SQLite column type.
     * @returns {number|null} - The size if available, otherwise null.
     */
    getColumnSize(sqliteType) {
        if (!sqliteType) return null;

        if(sqliteType.toUpperCase().indexOf('BOOL') !== -1)
        {
            return 1; // Boolean types are typically 1 byte in MySQL
        }

        const match = sqliteType.match(/\((\d+)\)/); // NOSONAR
        if (match && match[1]) /*NOSONAR*/ {
            return parseInt(match[1]);
        }
        return null;
    }
    
    /**
     * Converts a string (e.g., file or sheet name) into a valid entity/table name.
     *
     * This function ensures the result is compatible with database naming conventions by:
     * - Removing file extensions (e.g., `.csv`, `.xlsx`).
     * - Replacing non-alphanumeric characters with underscores.
     * - Converting the entire string to lowercase.
     * - Trimming leading and trailing underscores.
     *
     * @param {string} str - The original name (e.g., file name or sheet name).
     * @returns {string} A sanitized and valid table name in lowercase with underscores.
     */
    toValidTableName(str) {
        return str
            .replace(/\.[^/.]+$/, '') // NOSONAR
            .replace(/[^a-zA-Z0-9]+/g, '_') // NOSONAR
            .toLowerCase()
            .replace(/^_+|_+$/g, ''); // NOSONAR
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
        switch (dataType)
        {
            case "String":
                return "partial";
            default:
                return "exact";
        }
    }
}