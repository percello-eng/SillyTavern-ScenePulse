// Keep only fields the active output schema actually tracks. In particular,
// historical snapshots may contain built-ins from an earlier profile.
export function projectActiveState(snapshot, schema) {
    if (!snapshot || typeof snapshot !== 'object' || !schema?.properties) return snapshot;
    const projected = {};
    for (const key of Object.keys(schema.properties)) {
        if (Object.hasOwn(snapshot, key)) projected[key] = snapshot[key];
    }
    // elapsed and temporalIntent are companion signals for tracked time.
    // The dynamic panel schema omits them, but temporal-check uses both.
    if (Object.hasOwn(schema.properties, 'time')) {
        for (const key of ['elapsed', 'temporalIntent']) {
            if (Object.hasOwn(snapshot, key)) projected[key] = snapshot[key];
        }
    }
    return projected;
}
