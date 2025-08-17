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
                    let entity = new Entity(stringUtil.snakeize(tableName), index);

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
                                const snakeKey = stringUtil.snakeize(colName);
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
                            let columnName = stringUtil.snakeize(columnInfo[1]);
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
}