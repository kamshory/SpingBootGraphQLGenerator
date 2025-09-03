class SQLParser {

    constructor()
    {
        this.entities = [];
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
                    let entity = new Entity(StringUtil.snakeize(tableName), index);

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
                                const snakeKey = StringUtil.snakeize(colName);
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
                        let hasAutoIncrement = false;
                        const hasCompositePrimaryKey = tableInfo[0].values.filter(columnInfo => /*NOSONAR*/ columnInfo[5]).length > 1;

                        tableInfo[0].values.forEach(columnInfo => /*NOSONAR*/{
                            
                            let isAutoIncrement = columnInfo[2].toUpperCase() == 'INTEGER' && columnInfo[5];
                            if(hasAutoIncrement || hasCompositePrimaryKey)
                            {
                                isAutoIncrement = false;
                            }
                            let columnName = StringUtil.snakeize(columnInfo[1]);
                            let columnType = _this.toMySqlType(columnInfo[2]);
                            let columnSize = _this.getColumnSize(columnInfo[2]);
                            let isNull = columnInfo[3] === 1;
                            let defaultValue = columnInfo[4];
                            let isPrimaryKey = columnInfo[5];

                            if((columnSize == null || columnSize == 0) && columnType == 'BIGINT')
                            {
                                columnSize = '20';
                            }

                            const column = new Column(
                                columnName, // The name of the column.
                                columnType, // The SQL data type of the column (e.g., "VARCHAR", "INT", "ENUM").
                                columnSize, // The length or precision of the column (e.g., "255" for VARCHAR, or "10,2" for DECIMAL). Optional.
                                isNull, // Indicates whether the column allows NULL values.
                                defaultValue, // The default value assigned to the column. Optional.
                                isPrimaryKey, // Specifies whether the column is a primary key.
                                isAutoIncrement, // Indicates if the column value auto-increments (typically used for numeric primary keys).
                                null, // Valid values for ENUM/SET types, or value range for numeric types (comma-separated). Optional.
                            );
                            // Add the column to the entity
                            entity.addColumn(column);

                            if(hasAutoIncrement)
                            {
                                hasAutoIncrement = false;
                            }
                        });
                        importedEntities.push(entity); // Add the entity to the imported entities
                    }
                });

                if (_this.clearBeforeImport) {
                    _this.entities = importedEntities;
                } else {
                    let existing = [];
                    _this.entities.forEach((entity) => {
                        existing.push(entity.name);
                    });
                    importedEntities.forEach((entity) => {
                        if (!existing.includes(entity.name)) {
                            entity.index = _this.entities.length;
                            _this.entities.push(entity);
                        }
                    });
                }

                if (typeof callback === 'function') {
                    importedEntities = _this.calculateEntityDepth(importedEntities);
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

                let importedEntities = _this.createEntitiesFromSQL(tableParser.tableInfo); // Convert table structures into editor entities

                if (typeof callback === 'function') {
                    importedEntities = _this.calculateEntityDepth(importedEntities);
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
     * Calculates the module creation order based on dependencies (fields ending with `_id`).
     *
     * This function traverses the entities to build a dependency graph. It then uses a
     * Depth-First Search (DFS) algorithm to determine the "depth" of each module,
     * where depth represents its position in the dependency chain. Modules with no
     * dependencies have a lower initial depth.
     *
     * @param {Array<Object>} entities - A list of entity objects, each expected to have
     * a `name` property (string) and a `columns` property (array of objects).
     * Each column object should have a `name` property (string).
     * @param {boolean} [reverse=false] - If true, modules with no dependencies will have
     * the highest depth, and modules with the most dependencies will have a depth of 0.
     * If false (default), modules with no dependencies will have a depth of 1, and
     * depth increases with more dependencies.
     * @returns {Array<Object>} - The original list of entities, with an added `depth`
     * property (number) for each entity, indicating its calculated dependency depth.
     */
    calculateEntityDepth(entities, reverse = false) {
        // Create a quick lookup map from entity name to the entity object for efficient access.
        const nameToEntity = Object.fromEntries(entities.map(e => [e.name, e]));

        // Build the dependency graph: node -> parent dependencies.
        // A 'parent' is an entity that the current entity depends on (via an `_id` field).
        const graph = {};
        for (const entity of entities) {
            // Identify references by filtering columns ending with '_id' and removing the suffix.
            // Ensure the reference is not to itself and exists in the provided entities.
            const references = entity.columns
            .filter(col => col.name.endsWith('_id'))
            .map(col => col.name.replace(/_id$/, ''))
            .filter(ref => ref !== entity.name && nameToEntity[ref]);
            graph[entity.name] = references;
        }

        // A map to store the calculated depth for each entity to avoid redundant calculations
        // and handle memoization in the DFS.
        const visited = new Map();

        /**
         * Performs a Depth-First Search (DFS) to calculate the depth of a given entity.
         * The depth is determined by the maximum depth of its direct dependencies plus one.
         *
         * @param {string} entityName - The name of the entity for which to calculate the depth.
         * @param {Set<string>} [seen=new Set()] - A set to keep track of entities visited
         * in the current DFS path to detect and prevent infinite loops in cyclic dependencies.
         * @returns {number} The calculated depth of the entity.
         */
        function dfs(entityName, seen = new Set()) {
            // If the depth for this entity has already been calculated, return the stored value.
            if (visited.has(entityName)) return visited.get(entityName);
            // If the entity is already in the current 'seen' set, it means we've detected a cycle.
            // In this case, we return a base depth (0) to prevent infinite recursion,
            // effectively breaking the cycle for depth calculation.
            if (seen.has(entityName)) return 0;
            // Add the current entity to the 'seen' set to mark it as visited in this path.
            seen.add(entityName);

            // Get the direct parent dependencies for the current entity.
            const parents = graph[entityName] || [];

            // Calculate the maximum depth among all parent dependencies.
            // If there are no parents, the maxDepth is 0.
            const maxDepth = parents.length > 0
            ? Math.max(...parents.map(p => dfs(p, new Set(seen))))
            : 0;

            // The depth of the current entity is one more than the maximum depth of its parents.
            const depth = maxDepth + 1;
            // Store the calculated depth in the 'visited' map for future lookups.
            visited.set(entityName, depth);
            return depth;
        }

        // Calculate the depth for all entities by initiating DFS for each.
        for (const entity of entities) {
            entity.depth = dfs(entity.name);
        }

        // If the 'reverse' flag is true, adjust the depths so that modules with no
        // dependencies (originally lowest depth) now have the highest depth.
        if (reverse) {
            // Find the absolute maximum depth calculated across all entities.
            const maxDepth = Math.max(...entities.map(e => e.depth));
            // Invert the depth: (max_depth - current_depth) ensures that a small current_depth
            // results in a large new_depth, and vice-versa.
            for (const entity of entities) {
            entity.depth = maxDepth - entity.depth;
            }
        }

        return entities;
    }

    /**
     * Sorts a list of entities based on their previously calculated `depth` property.
     *
     * By default, entities are sorted in ascending order of depth, meaning entities
     * with fewer dependencies (lower depth) come first. If `reverse` is true, the
     * sorting order is inverted, placing entities with more dependencies (higher depth)
     * first, effectively making entities with no dependencies appear last.
     *
     * @param {Array<Object>} entities - A list of entity objects. Each entity object
     * must already have a `depth` property (number), typically added by `calculateEntityDepth`.
     * @param {boolean} [reverse=false] - If true, the sorting order is reversed.
     * Entities with higher original depths will appear earlier in the sorted list.
     * @returns {Array<Object>} - A *new* array containing the entities sorted
     * according to their depth. The original `entities` array is not modified.
     */
    sortEntitiesByDepth(entities, reverse = false) {
        // If `reverse` is true, we adjust the `depth` values temporarily for sorting.
        // This effectively inverts the sorting order so that entities with the highest
        // original depth will have the lowest adjusted depth, thus coming first.
        if (reverse) {
            // Find the maximum depth among all entities to use as a baseline for inversion.
            const maxDepth = Math.max(...entities.map(e => e.depth));
            // Iterate through entities and re-map their `depth` for reverse sorting.
            // A smaller original depth results in a larger new depth, and vice-versa.
            for (const entity of entities) {
            entity.depth = maxDepth - entity.depth;
            }
        }

        // Return a new sorted array. Using `[...entities]` creates a shallow copy
        // to avoid modifying the original array, and then sorts it based on the `depth` property.
        return [...entities].sort((a, b) => a.depth - b.depth);
    }
}