let stringUtil = new StringUtil();
let generator = new GraphQLSpringGenerator();
let sqlParser = new SQLParser();
let util = new GraphQLSchemaUtils();
let entityRenderer;
let updatedWidth = 600;
let drawRelationship = true;

/**
 * Autopopulates the JDBC driver class name and Hibernate dialect
 * based on the provided JDBC URL.
 *
 * Supported databases:
 * - MySQL, MariaDB, PostgreSQL, SQLite, Oracle, SQL Server,
 *   H2, Derby, DB2, Firebird, Sybase
 *
 * @param {string} url - The JDBC connection URL (e.g., "jdbc:mysql://localhost:3306/db")
 * @returns {void}
 */
function autopopulateDriverAndDialect(url) {
    const dbDriverInput = document.getElementById("dbDriver");
    const dbDialectInput = document.getElementById("dbDialect");

    if (url.startsWith("jdbc:mysql:")) {
        dbDriverInput.value = "com.mysql.cj.jdbc.Driver";
        dbDialectInput.value = "org.hibernate.dialect.MySQL8Dialect";
    } else if (url.startsWith("jdbc:mariadb:")) {
        dbDriverInput.value = "org.mariadb.jdbc.Driver";
        dbDialectInput.value = "org.hibernate.dialect.MariaDBDialect";
    } else if (url.startsWith("jdbc:postgresql:")) {
        dbDriverInput.value = "org.postgresql.Driver";
        dbDialectInput.value = "org.hibernate.dialect.PostgreSQLDialect";
    } else if (url.startsWith("jdbc:sqlite:")) {
        dbDriverInput.value = "org.sqlite.JDBC";
        dbDialectInput.value = "org.hibernate.dialect.SQLiteDialect"; // custom
    } else if (url.startsWith("jdbc:oracle:")) {
        dbDriverInput.value = "oracle.jdbc.OracleDriver";
        dbDialectInput.value = "org.hibernate.dialect.Oracle12cDialect";
    } else if (url.startsWith("jdbc:sqlserver:")) {
        dbDriverInput.value = "com.microsoft.sqlserver.jdbc.SQLServerDriver";
        dbDialectInput.value = "org.hibernate.dialect.SQLServer2012Dialect";
    } else if (url.startsWith("jdbc:h2:")) {
        dbDriverInput.value = "org.h2.Driver";
        dbDialectInput.value = "org.hibernate.dialect.H2Dialect";
    } else if (url.startsWith("jdbc:derby:")) {
        dbDriverInput.value = "org.apache.derby.jdbc.EmbeddedDriver";
        dbDialectInput.value = "org.hibernate.dialect.DerbyDialect";
    } else if (url.startsWith("jdbc:db2:")) {
        dbDriverInput.value = "com.ibm.db2.jcc.DB2Driver";
        dbDialectInput.value = "org.hibernate.dialect.DB2Dialect";
    } else if (url.startsWith("jdbc:firebird:")) {
        dbDriverInput.value = "org.firebirdsql.jdbc.FBDriver";
        dbDialectInput.value = "org.hibernate.dialect.FirebirdDialect"; // custom
    } else if (url.startsWith("jdbc:sybase:")) {
        dbDriverInput.value = "com.sybase.jdbc4.jdbc.SybDriver";
        dbDialectInput.value = "org.hibernate.dialect.SybaseDialect";
    }
}

/**
 * Autopopulates groupId, artifactId, and serviceName
 * based on the given Java package name.
 *
 * Rules:
 * - groupId = the package name itself
 * - artifactId = the last segment of the package
 * - serviceName = artifactId converted to Title Case
 *
 * @param {string} packageName - The full Java package name (e.g., "com.example.payment")
 * @returns {void}
 */
function autopopulatePackage(packageName) {
    const groupIdInput = document.getElementById("groupId");
    const artifactIdInput = document.getElementById("artifactId");
    const serviceNameInput = document.getElementById("serviceName");
    const pkg = packageName.trim();

    if (!pkg) {
        groupIdInput.value = '';
        artifactIdInput.value = '';
        serviceNameInput.value = '';
        return;
    }

    // Group ID = package name
    groupIdInput.value = pkg;

    // Artifact ID = bagian terakhir dari package
    const parts = pkg.split(".");
    const artifact = parts[parts.length - 1];
    artifactIdInput.value = artifact;

    // Service Name = Title Case dari artifact
    serviceNameInput.value = artifact
        .split(/[-_]/) // pisah kalau ada - atau _
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Applies the given model to the generator and updates the maximum relation depth.
 *
 * - Calculates the maximum relation depth among entities
 * - Subtracts 1 for generator usage
 * - Updates the "maxRelationDepth" input field
 * - Sets the model to the global generator
 *
 * @param {Object} model - The model containing entities
 * @param {Object[]} model.entities - Array of entities
 * @param {number} model.entities[].depth - Depth value for each entity
 * @returns {void}
 */
function applyModel(model) {
    const maxRelationDepthInput = document.getElementById('maxRelationDepth');
    let maxRelationDepth = Math.max(...model.entities.map(obj => obj.depth)) - 1;
    maxRelationDepthInput.value = maxRelationDepth;
    generator.setModel(model);
}

let resizeTimeout;

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const wrapper = document.querySelector('.erd-wrapper');
        if (wrapper) {
            let width = wrapper.clientWidth;
            if(width < 480)
            {
                width = 480;
            }
            entityRenderer.createERD(
                generator.getModel(),
                width, 
                drawRelationship
            );

            entityRenderer.createDescription(generator.getModel(), '#erd-description');
        }
    }, 30); 
});
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('configForm');
    const packageNameInput = document.getElementById("packageName");
    const dbUrlInput = document.getElementById("dbUrl");
    const sqlFileInput = document.getElementById('sqlFile');
    
    entityRenderer = new EntityRenderer(".erd-svg");
    entityRenderer.initIconEvent(generator);
    const wrapper = document.querySelector('.erd-wrapper');
    if (wrapper) {
        updatedWidth = wrapper.clientWidth;
    }

    packageNameInput.addEventListener('change', function (e) {
        autopopulatePackage(e.target.value);
    });
    packageNameInput.addEventListener('keyup', function (e) {
        autopopulatePackage(e.target.value);
    });

    dbUrlInput.addEventListener('change', function (e) {
        autopopulateDriverAndDialect(e.target.value);
    });
    dbUrlInput.addEventListener('keyup', function (e) {
        autopopulateDriverAndDialect(e.target.value);
    });

    sqlFileInput.addEventListener('change', function (e) {
        const formData = new FormData(form);
        const sqlFile = formData.get('sqlFile');
        if (sqlFile) {
            sqlParser.importSQLFile(sqlFile, (model) => {
                applyModel(model);
                if(updatedWidth < 480)
                {
                    updatedWidth = 480;
                }
                entityRenderer.createERD(model, updatedWidth, drawRelationship);
                entityRenderer.createDescription(model, '#erd-description');
            });
        }
    });

    const formDataInit = new FormData(form);
    const sqlFileInit = formDataInit.get('sqlFile');
    if (sqlFileInit) {
        sqlParser.importSQLFile(sqlFileInit, (model) => {
            applyModel(model);
            if(updatedWidth < 480)
            {
                updatedWidth = 480;
            }
            entityRenderer.createERD(model, updatedWidth, drawRelationship);
            entityRenderer.createDescription(model, '#erd-description');
        });
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const config = {
            packageName: formData.get('packageName'),
            groupId: formData.get('groupId'),
            artifactId: formData.get('artifactId'),
            serviceName: formData.get('serviceName'),
            serviceDescription: formData.get('serviceDescription'),
            javaVersion: formData.get('javaVersion'),
            version: formData.get('version'),
            maxRelationDepth: parseInt(formData.get('maxRelationDepth')) || 3,
        };
        generator.createZipFile(null, config, document.querySelector('#artifactId').value + ".zip");
    });
});