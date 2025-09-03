class TypeUtil{
    
    /**
     * Maps SQL column type to Java type.
     * @param {string} type - The SQL column type.
     * @returns {string} The corresponding Java type.
     */
    static getJavaType(type) {
        let lowercase = type.toLowerCase();
        if (lowercase.indexOf("int") !== -1 && lowercase.indexOf("tinyint") == -1) {
            return "Long";
        } else if (lowercase.indexOf("boolean") !== -1 || lowercase.indexOf("tinyint") !== -1) {
            return "Boolean";
        } else if (lowercase.indexOf("longtext") !== -1) {
            return "String";
        } else if (lowercase.indexOf("long") !== -1 || lowercase.indexOf("bigint") !== -1) {
            return "Long";
        } else if (lowercase.indexOf("string") !== -1 || lowercase.indexOf("varchar") !== -1 || lowercase.indexOf("text") !== -1) {
            return "String";
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
        return "String";
    }
}