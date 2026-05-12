const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL ?? "info"] ?? 2;

function emit(level, ...args) {
  if (levels[level] > currentLevel) return;
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](`[${ts}] [${level.toUpperCase()}]`, ...args);
}

export const logger = {
  error: (...a) => emit("error", ...a),
  warn: (...a) => emit("warn", ...a),
  info: (...a) => emit("info", ...a),
  debug: (...a) => emit("debug", ...a)
};
