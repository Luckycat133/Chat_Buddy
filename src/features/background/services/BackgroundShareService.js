/**
 * Background Share Service
 * Handles export and import of background configurations as JSON files.
 */
const MAGIC_TYPE = 'chat-buddy-background';

class BackgroundShareService {
    /**
     * Export a background config to a downloadable JSON file.
     * @param {object} config - The background configuration object
     */
    exportConfig(config) {
        const payload = {
            _type: MAGIC_TYPE,
            _version: 1,
            _exportedAt: new Date().toISOString(),
            config: {
                ...config,
                // Strip any raw base64 data for file size reasons
                value: config.type === 'custom' ? null : config.value,
            }
        };

        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-buddy-bg-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Import a background config from JSON string.
     * @param {string} jsonStr - The JSON string content
     * @returns {object} The validated config object
     * @throws {Error} If the file is invalid
     */
    async importConfig(jsonStr) {
        let parsed;
        try {
            parsed = JSON.parse(jsonStr);
        } catch {
            throw new Error('Invalid JSON');
        }

        if (parsed._type !== MAGIC_TYPE) {
            throw new Error('Invalid background config file');
        }

        if (!parsed.config || typeof parsed.config !== 'object') {
            throw new Error('Invalid background config file');
        }

        return parsed.config;
    }
}

export default new BackgroundShareService();
