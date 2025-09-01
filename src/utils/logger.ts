/* simple logger; could swap for pino later */
export const log = {
info: (...a: unknown[]) => console.log('[info]', ...a),
warn: (...a: unknown[]) => console.warn('[warn]', ...a),
error: (...a: unknown[]) => console.error('[error]', ...a),
debug: (...a: unknown[]) => { if (process.env.DEBUG) console.log('[debug]', ...a); }
};