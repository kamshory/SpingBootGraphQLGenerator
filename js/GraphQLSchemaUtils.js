class GraphQLSchemaUtils {

    /**
     * @private
     * @type {string[]}
     * An array of reserved GraphQL scalar types.
     */
    reservedTypes = [
        'String',
        'Int',
        'Float',
        'Boolean',
        'ID'
    ];


    /**
     * @private
     * Normalizes a name for case-insensitive comparison by removing underscores and spaces.
     * @param {string} name The name to normalize.
     * @returns {string} The normalized name.
     */
    normalizeNameForComparison(name) {
        return name.replace(/[_\s]/g, '').toLowerCase();
    }

    /**
     * Normalizes a collection of entities by standardizing column names, types, and relationships.
     * This method converts relationship fields to use the referencing entity's ID type and standardizes
     * naming conventions based on the specified mode. It also normalizes the entity names themselves.
     *
     * @param {object} entities The raw entities object.
     * @param {string} [mode="snake"] - The desired naming convention for names ("snake" or "camel").
     * @returns {object} The normalized entities object.
     */
    normalizeEntity(entities, mode = "snake") {
        const normalizedEntities = {};

        for (const [entityName, columns] of Object.entries(entities)) {
            let normalizedEntityName = entityName;

            // Normalize the entity name itself based on the mode
            if (mode === "snake") {
                if (!normalizedEntityName.includes('_')) {
                    normalizedEntityName = StringUtil.snakeize(normalizedEntityName);
                }
            } else if (mode === "camel") {
                if (normalizedEntityName.includes('_')) {
                    normalizedEntityName = StringUtil.camelize(normalizedEntityName);
                }
            }

            normalizedEntities[normalizedEntityName] = columns.map(col => /*NOSONAR*/ {
                let { name, type, nullable } = col;

                // Check if the column type is a custom entity type (not a reserved scalar)
                if (!this.reservedTypes.includes(type)) {
                    const referencedEntityName = type;

                    if (!/id$/i.test(name)) {
                        name = this.normalizeNameForComparison(name) === this.normalizeNameForComparison(referencedEntityName)
                            ? name + "Id"
                            : name;
                    }

                    const referencedEntity = entities[referencedEntityName];
                    if (referencedEntity) {
                        const refColumn = referencedEntity.find(c =>
                            this.normalizeNameForComparison(c.name) === this.normalizeNameForComparison(name)
                        );
                        if (refColumn) {
                            type = refColumn.type;
                        }
                    }
                }

                const hasUnderscore = name.includes('_');

                if (mode === "camel") {
                    if (hasUnderscore) {
                        name = StringUtil.camelize(name);
                    }
                } else if (mode === "snake") {
                    if (!hasUnderscore && /[a-z][A-Z]/.test(name)) {
                        name = StringUtil.snakeize(name);
                    }
                }

                if (type === "ID") {
                    type = "String";
                }

                return { name, type, nullable };
            });
        }

        return normalizedEntities;
    }

    /**
     * Parses a GraphQL schema string into a structured JavaScript object.
     * The parser extracts `type` and `input` definitions, along with their fields,
     * types, and nullability.
     *
     * @param {string} schemaString The GraphQL schema string to parse.
     * @returns {object} An object containing all parsed types and input definitions.
     */
    parseGraphQLSchema(schemaString) {
        const parsedSchema = {
            types: {},
            inputs: {}
        };

        const typeRegex = /(type|input)\s+(\w+)\s*\{([\s\S]*?)\}/g;
        let match;

        while ((match = typeRegex.exec(schemaString)) !== null) {
            const typeOrInput = match[1];
            const typeName = match[2];
            const fieldsBlock = match[3];

            // Skip the Query type as it is not a data model
            if (typeName === 'Query') {
                continue;
            }

            const fields = [];
            const fieldRegex = /(\w+):\s*([\w!]+)/g;
            let fieldMatch;

            // Extract fields and their types
            while ((fieldMatch = fieldRegex.exec(fieldsBlock)) !== null) {
                const fieldName = fieldMatch[1];
                let fieldType = fieldMatch[2];
                const isRequired = fieldType.endsWith('!');
                if (isRequired) {
                    fieldType = fieldType.slice(0, -1);
                }
                fields.push({
                    name: fieldName,
                    type: fieldType,
                    nullable: !isRequired
                });
            }

            if (typeOrInput === 'type') {
                // Store as a type definition
                parsedSchema.types[typeName] = fields;
            } else if (typeOrInput === 'input') {
                // Store as an input definition
                parsedSchema.inputs[typeName] = fields;
            }
        }
        return parsedSchema;
    }

    /**
     * Builds a GraphQL schema string based on a list of database entities and their columns.
     *
     * This method maps SQL data types to GraphQL types, detects relationships based on
     * foreign key naming conventions (fields ending with `_id`), and generates both
     * `type` definitions and corresponding `input` types for mutations.
     *
     * ### Features:
     * - Converts SQL types (e.g., VARCHAR, INT) to equivalent GraphQL scalar types.
     * - Supports custom camelCase and UpperCamelCase name formatting for GraphQL fields and types.
     * - Automatically detects relationships between entities using `_id` suffix convention
     * and generates proper GraphQL relationship fields.
     * - Optionally removes scalar `_id` fields when a relationship field is generated
     * (`removeIdFields` flag).
     * - Generates input types for mutations, handling composite primary keys and required fields.
     * - Generates a root `Query` type for fetching single entities and collections.
     *
     * @param {Array<Object>} entities - The list of entities to include in the schema.
     * Each entity should have:
     * - {string} name - The entity/table name.
     * - {Array<Object>} columns - Column definitions with:
     * - {string} name - Column name.
     * - {string} type - SQL data type (case-insensitive).
     * - {boolean} [nullable=true] - Whether the field is nullable.
     * - {boolean} [primaryKey=false] - Whether the column is a primary key.
     * @param {boolean} [removeIdFields=true] - If true, removes raw `_id` scalar fields
     * when a relationship field is generated for that column.
     * @param {string} [paginationMode="offset"] - The pagination mode to use ("offset" or "cursor").
     *
     * @returns {string} A complete GraphQL schema as a string, including type definitions,
     * input types, and the root Query type for all entities.
     *
     * @example
     * const schema = buildGraphQLSchema(entities, false);
     */
    buildGraphQLSchema(entities, removeIdFields = true, paginationMode = "offset") {
        const sqlToGraphQL = {
            CHAR: "String",
            VARCHAR: "String",
            TEXT: "String",
            LONGTEXT: "String",
            INT: "Int",
            INTEGER: "Int",
            BIGINT: "Int",
            SMALLINT: "Int",
            TINYINT: "Boolean",
            DECIMAL: "Float",
            NUMERIC: "Float",
            FLOAT: "Float",
            DOUBLE: "Float",
            REAL: "Float",
            BOOLEAN: "Boolean",
            DATE: "String",
            DATETIME: "String",
            TIMESTAMP: "String",
            TIME: "String",
            ENUM: "String",
            SET: "String"
        };
        
        let schema = `# GraphQL Schema generated by GraphQL Generator\n\n`;
        
        // Add standard PageInfo and Connection types for cursor-based pagination
        if (paginationMode === "cursor") {
            schema += `type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String!
    endCursor: String!
}

`;
        }
        else
        {
            schema += `type PageInfo {
    totalCount: Int!
    totalPages: Int!
    currentPage: Int!
    pageSize: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
}
    
`;
        }
        
        // Generate TYPE definitions
        entities.forEach(entity => {
            let typeName = StringUtil.upperCamel(entity.name);
            schema += `\ntype ${typeName} {\n`;
        
            entity.columns.forEach(col => /*NOSONAR*/ {
                let isRelation = false;
                let isRequired = false;

                let savedRelation = '';

                if (col.name.endsWith("_id")) {
                    const relatedEntityName = col.name.slice(0, -3);
                    const relatedEntity = entities.find(
                        e => e.name.toLowerCase() === relatedEntityName.toLowerCase()
                    );

                    if (relatedEntity && relatedEntity.name.toLowerCase() !== entity.name.toLowerCase()) {
                        const relType = StringUtil.upperCamel(relatedEntity.name);
                        const relField = StringUtil.camelize(relatedEntity.name);
                        savedRelation += `    ${relField}: ${relType}${col.nullable ? "" : "!"}\n`;
                        isRelation = true;
                    }
                }
                
                // Non-nullable relationships are always required
                if (isRelation && !col.nullable) {
                    isRequired = true;
                }

                // Primary keys are always required
                if (col.primaryKey) {
                    isRequired = true;
                }

                // Non-key, non-nullable columns are also required
                if (!col.primaryKey && !isRelation && !col.nullable) {
                    isRequired = true;
                }

                if (!(removeIdFields && isRelation)) {
                    let gqlType;
                    if (col.primaryKey) {
                        gqlType = "ID";
                    } else {
                        gqlType = sqlToGraphQL[col.type.toUpperCase()] || "String";
                    }
                    
                    if (isRequired) {
                        gqlType += "!";
                    }
                    
                    schema += `    ${StringUtil.camelize(col.name)}: ${gqlType}\n`;
                }
                schema += savedRelation;
            });

            schema += `}\n`;
            
            // Generate Connection and Edge types for cursor-based pagination
            if (paginationMode === "cursor") {
                const connectionTypeName = `${typeName}Connection`;
                const edgeTypeName = `${typeName}Edge`;
                
                schema += `
type ${connectionTypeName} {
    edges: [${edgeTypeName}]
    pageInfo: PageInfo!
}

type ${edgeTypeName} {
    node: ${typeName}
    cursor: String!
}
`;
            }
            else
            {
                const connectionTypeName = `${typeName}Connection`;
                
                schema += `
type ${connectionTypeName} {
    pageInfo: PageInfo!
    data: [${typeName}]
}

`;
            }
        });

        // Generate INPUT definitions
        entities.forEach(entity => {

            let createName = StringUtil.upperCamel(entity.name) + "Create";
            let updateName = StringUtil.upperCamel(entity.name) + "Update";

            const primaryKeys = entity.columns.filter(col => col.primaryKey);
            const isCompositeKey = primaryKeys.length > 1;
            
            schema += `\ninput ${createName} {\n`;



            entity.columns.forEach(col => {
                if(!col.autoIncrement)
                {
                    const isRelation =
                        col.name.endsWith("_id") &&
                        entities.some(
                            e => e.name.toLowerCase() === col.name.slice(0, -3).toLowerCase() &&
                                    e.name.toLowerCase() !== entity.name.toLowerCase()
                        );

                    let gqlType;
                    if (col.primaryKey || isRelation) {
                        gqlType = "ID";
                    } else {
                        gqlType = sqlToGraphQL[col.type.toUpperCase()] || "String";
                    }

                    const isRequired =
                        (isCompositeKey && col.primaryKey) ||
                        (isRelation && !col.nullable) ||
                        (!col.primaryKey && !isRelation && !col.nullable);

                    if (isRequired) {
                        gqlType += "!";
                    }

                    schema += `    ${StringUtil.camelize(col.name)}: ${gqlType}\n`;
                }
            });

            schema += `}\n`;

            schema += `\ninput ${updateName} {\n`;

            entity.columns.forEach(col => {
                const isRelation =
                    col.name.endsWith("_id") &&
                    entities.some(
                        e => e.name.toLowerCase() === col.name.slice(0, -3).toLowerCase() &&
                                e.name.toLowerCase() !== entity.name.toLowerCase()
                    );

                let gqlType;
                if (col.primaryKey || isRelation) {
                    gqlType = "ID";
                } else {
                    gqlType = sqlToGraphQL[col.type.toUpperCase()] || "String";
                }

                const isRequired =
                    (isCompositeKey && col.primaryKey) ||
                    (isRelation && !col.nullable) ||
                    (!col.primaryKey && !isRelation && !col.nullable);

                if (isRequired) {
                    gqlType += "!";
                }

                schema += `    ${StringUtil.camelize(col.name)}: ${gqlType}\n`;
            });

            schema += `}\n`;
        });
        
        schema += `\ninput DataFilter{
    fieldName: String,
    fieldValue: String
}\n`;

        schema += `\ninput DataOrder{
    fieldName: String,
    orderType: String
}\n`;

        // Add Query block
        schema += `\ntype Query {\n`;
        entities.forEach(entity => {
            const typeName = StringUtil.upperCamel(entity.name);
            const camelCaseName = StringUtil.camelize(entity.name);
            
            // Find all primary key columns
            const primaryKeyCols = entity.columns.filter(c => c.primaryKey);

            // If there are primary keys, create a query to fetch a single entity
            if (primaryKeyCols.length > 0) {
                // Combine all primary keys into a single argument string
                const primaryKeyArgs = primaryKeyCols.map(col => {
                    const primaryKeyName = StringUtil.camelize(col.name);
                    return `${primaryKeyName}: ID`;
                }).join(', ');
                
                const singleQueryName = `get${typeName}`;
                schema += `    ${singleQueryName}(${primaryKeyArgs}): ${typeName}\n`;
            }

            // Add a query for all entities with pagination arguments
            const pluralName = `${camelCaseName}s`;
            const allQueryName = `get${StringUtil.upperCamel(pluralName)}`;

            if (paginationMode === "offset") {
                 schema += `    ${allQueryName}(pageNumber: Int, pageSize: Int, dataFilter: [DataFilter], dataOrder: [DataOrder]): ${typeName}Connection\n`;
            } else if (paginationMode === "cursor") {
                schema += `    ${allQueryName}(first: Int, after: String, last: Int, before: String): ${typeName}Connection\n`;
            }
        });
        schema += `}\n`;
        
        // Add Mutation block
        schema += `\ntype Mutation {\n`;
        entities.forEach(entity => {
            const typeName = StringUtil.upperCamel(entity.name);
            const createName = `${typeName}Create`;
            const updatename = `${typeName}Update`;

            // Find all primary key columns
            const primaryKeyCols = entity.columns.filter(c => c.primaryKey);

            // Create mutation
            schema += `    create${typeName}(input: ${createName}!): ${typeName}\n`;
            schema += `    update${typeName}(input: ${updatename}!): ${typeName}\n`;

            // Delete mutation — pakai semua PK sebagai parameter
            if (primaryKeyCols.length > 0) {
                const pkArgs = primaryKeyCols
                    .map(pk => `${StringUtil.camelize(pk.name)}: ID!`)
                    .join(', ');
                schema += `    delete${typeName}(${pkArgs}): Boolean\n`;
            }
        });
        schema += `}\n`;
        
        return schema;
    }
}