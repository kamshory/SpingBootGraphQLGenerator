class StringUtil
{
    /**
     * Converts a string to camelCase format.
     * @param {string} str - The input string.
     * @returns {string} The camelCase formatted string.
     */
    static camelize(str) {
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
    static upperCamel(camelCaseStr) {
        return camelCaseStr
            .replace(/([A-Z])/g, '$1')
            .replace(/^./, str => str.toUpperCase());
    }

    /**
     * Converts a string to snake_case format.
     * @param {string} header - The input string.
     * @returns {string} The snake_case formatted string.
     */
    static snakeize(header) {
        let ucwords = header
            .replace(/[_\-]+/g, ' ') // NOSONAR
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[^a-zA-Z0-9 ]+/g, '')
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase());
        let name = ucwords
            .replace(/\s+/g, "_")
            .toLowerCase()
            .replace(/^_+|_+$/g, "") // NOSONAR
            .replace(/__+/g, "_");
        return name;
    }
}