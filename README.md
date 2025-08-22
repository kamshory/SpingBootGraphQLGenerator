# Spring Boot GraphQL Generator

Spring Boot GraphQL Generator is an automatic code generator for building GraphQL applications with Spring Boot.

## Features

* **Input Options:**

  * SQL files containing `CREATE TABLE` statements
  * SQLite database files

* **Configuration:**
  Users can specify:

  * Package name
  * Artifact name
  * Database driver
  * Host and port
  * Database username and password

* **Output:**

  * A ready-to-use Spring Boot application with GraphQL and JPA integration
  * The generated project can be built and executed immediately
  * Fully customizable codebase for further development

* **Diagram Renderer:**

  * Automatically generates an **ERD (Entity Relationship Diagram)** based on the input
  * Supports both SQL files and SQLite database files
  * Visualizes table structures, columns, primary keys, and relationships

## How It Works

1. The user provides an SQL file or a SQLite database file as input.
2. The user configures the application settings as needed.
3. The generator creates a complete Spring Boot project with GraphQL and JPA support.
4. The **Diagram Renderer** produces an ERD for the database structure.
5. The generated application can be run instantly and customized as required.

## Purpose

Spring Boot GraphQL Generator aims to simplify and accelerate the process of creating GraphQL applications with Spring Boot. By automating the initial setup, developers can focus on implementing business logic and custom features rather than boilerplate configuration.

