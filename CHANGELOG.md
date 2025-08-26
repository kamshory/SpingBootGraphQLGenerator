# Version 0.0.0

Release Date 2025-08-23

## Features
- **Input Options**  
  * SQL files containing `CREATE TABLE` statements  
  * SQLite database files  

- **Configuration**  
  Users can configure:  
  * Package name  
  * Artifact name  
  * Database driver  
  * Host and port  
  * Database username and password  

- **Output**  
  * A ready-to-use Spring Boot application with GraphQL and JPA integration  
  * The generated project can be built and executed immediately  
  * Fully customizable codebase for further development  

- **Entity Relationship Diagram (ERD) Renderer**  
  A new visualization feature has been added to help developers better understand the database schema.  
  The ERD is automatically generated from the input source (SQL file or SQLite database) and displays:  
  * Tables and their relationships  
  * Columns with data types  
  * Primary keys and foreign keys  

# Version 0.1.0

Release Date 2025-08-27

## Added

- **Entity Description Table**  
  Each detected entity now has its own descriptive table showing:  
  * Table name  
  * Columns and data types  
  * Primary keys  
  * Auto-increment information (if applicable)  
  This makes it easier to inspect and validate the database structure before code generation.  

- **Entity Selection with Checkboxes**  
  Users can now selectively choose which entities should be included in the generated GraphQL application.  
  This gives more flexibility by allowing partial code generation, avoiding unnecessary entities in the final project.  

## Improvements

- Enhanced workflow to provide more control over the generation process.  
- Improved visualization for better readability and clarity of schema details.  

