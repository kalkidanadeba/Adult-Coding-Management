const util = require('util');
const vm = require('vm');
const { parentPort, workerData } = require('worker_threads');

const {
  code,
  stdin = '',
  timeoutMs = 2000,
  maxOutputLength = 8000
} = workerData;

const startedAt = Date.now();
const logs = [];
let outputChars = 0;
let truncated = false;

const formatValue = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }

  return util.inspect(value, {
    depth: 4,
    breakLength: 120,
    maxArrayLength: 100,
    maxStringLength: 1000
  });
};

const getValueType = (value) => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
};

const serializeResult = (value) => {
  const type = getValueType(value);

  return {
    type,
    display: type === 'undefined' ? null : formatValue(value)
  };
};

const appendLog = (type, args) => {
  if (outputChars >= maxOutputLength) {
    truncated = true;
    return;
  }

  const text = args.map(formatValue).join(' ');
  const separatorLength = logs.length > 0 ? 1 : 0;
  const remaining = maxOutputLength - outputChars - separatorLength;

  if (remaining <= 0) {
    truncated = true;
    return;
  }

  const clippedText = text.length > remaining ? text.slice(0, remaining) : text;
  logs.push({ type, text: clippedText });
  outputChars += clippedText.length + separatorLength;

  if (clippedText.length < text.length) {
    truncated = true;
  }
};

const inputText = String(stdin || '');
const inputLines = inputText.split(/\r?\n/);
let inputLineIndex = 0;

const readLine = () => {
  if (inputLineIndex >= inputLines.length) {
    return '';
  }

  const line = inputLines[inputLineIndex];
  inputLineIndex += 1;
  return line;
};

const consoleProxy = Object.freeze({
  log: (...args) => appendLog('log', args),
  info: (...args) => appendLog('info', args),
  warn: (...args) => appendLog('warn', args),
  error: (...args) => appendLog('error', args),
  clear: () => {
    logs.splice(0, logs.length);
    outputChars = 0;
    truncated = false;
  }
});

const sandbox = Object.create(null);
Object.defineProperties(sandbox, {
  console: { value: consoleProxy, enumerable: true },
  input: { value: inputText, enumerable: true },
  stdin: { value: inputText, enumerable: true },
  print: { value: (...args) => appendLog('log', args), enumerable: true },
  prompt: { value: readLine, enumerable: true },
  readLine: { value: readLine, enumerable: true },
  readline: { value: readLine, enumerable: true }
});

const buildOutput = () => logs.map((log) => log.text).join('\n');

try {
  const context = vm.createContext(sandbox, {
    name: 'MonacoExecutionContext',
    codeGeneration: {
      strings: false,
      wasm: false
    }
  });
  const script = new vm.Script(code, {
    filename: 'monaco-user-code.js',
    displayErrors: false
  });
  const result = script.runInContext(context, {
    timeout: Number(timeoutMs),
    displayErrors: false
  });

  parentPort.postMessage({
    success: true,
    output: buildOutput(),
    logs,
    result: serializeResult(result),
    error: null,
    timedOut: false,
    truncated,
    executionTimeMs: Date.now() - startedAt
  });
} catch (error) {
  const timedOut = /Script execution timed out/i.test(error.message || '');

  parentPort.postMessage({
    success: false,
    output: buildOutput(),
    logs,
    result: null,
    error: {
      name: timedOut ? 'TimeoutError' : error.name || 'ExecutionError',
      message: timedOut ? `Execution exceeded ${timeoutMs}ms` : error.message
    },
    timedOut,
    truncated,
    executionTimeMs: Date.now() - startedAt
  });
}
