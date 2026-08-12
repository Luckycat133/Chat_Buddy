const INTERNAL_TOOL_RULES = {
    MEMORY_REQUEST: (persona) => Boolean(persona?.memory?.enabled && persona?.memory?.longTermEnabled),
};

function getDeclaredToolNames(persona) {
    if (!Array.isArray(persona?.tools)) return new Set();
    return new Set(persona.tools.map((tool) => tool?.name).filter(Boolean));
}

export function getToolAuthorization(persona, toolName) {
    if (!persona?.id) {
        return { allowed: false, reason: 'missing_requester' };
    }

    if (typeof toolName !== 'string' || !toolName.trim()) {
        return { allowed: false, reason: 'invalid_tool_name' };
    }

    const internalRule = INTERNAL_TOOL_RULES[toolName];
    if (internalRule) {
        return internalRule(persona)
            ? { allowed: true, reason: null }
            : { allowed: false, reason: 'capability_disabled' };
    }

    if (persona.toolsEnabled !== true) {
        return { allowed: false, reason: 'tools_disabled' };
    }

    if (!getDeclaredToolNames(persona).has(toolName)) {
        return { allowed: false, reason: 'tool_not_allowed' };
    }

    return { allowed: true, reason: null };
}

export function assertToolAuthorized(persona, toolName) {
    const authorization = getToolAuthorization(persona, toolName);
    if (authorization.allowed) return;

    const error = new Error(`Tool access denied: ${toolName} (${authorization.reason})`);
    error.name = 'ToolAuthorizationError';
    error.code = authorization.reason;
    throw error;
}
