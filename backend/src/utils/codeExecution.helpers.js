const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { Worker } = require('worker_threads');

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const MIN_TIMEOUT_MS = 100;
const DEFAULT_TIMEOUT_MS = parsePositiveInt(process.env.CODE_EXECUTION_TIMEOUT_MS, 2000);
const MAX_TIMEOUT_MS = parsePositiveInt(process.env.CODE_EXECUTION_MAX_TIMEOUT_MS, 5000);
const MAX_CODE_LENGTH = parsePositiveInt(process.env.CODE_EXECUTION_MAX_CODE_LENGTH, 20000);
const MAX_INPUT_LENGTH = parsePositiveInt(process.env.CODE_EXECUTION_MAX_INPUT_LENGTH, 10000);
const MAX_OUTPUT_LENGTH = parsePositiveInt(process.env.CODE_EXECUTION_MAX_OUTPUT_LENGTH, 8000);

const availabilityCache = new Map();

const commandExists = (command, args = ['--version']) => {
  const key = `${command} ${args.join(' ')}`;

  if (availabilityCache.has(key)) {
    return availabilityCache.get(key);
  }

  const result = spawnSync(command, args, {
    stdio: 'ignore',
    windowsHide: true,
    timeout: 1500
  });
  const exists = !result.error;
  availabilityCache.set(key, exists);
  return exists;
};

const getPythonCommand = () => {
  const candidates = [
    { command: 'python3', args: [] },
    { command: 'python', args: [] },
    { command: 'py', args: ['-3'], versionArgs: ['-3', '--version'] }
  ];

  return candidates.find((candidate) => (
    commandExists(candidate.command, candidate.versionArgs || ['--version'])
  )) || null;
};

const getExecutablePath = (tempDir) => (
  path.join(tempDir, process.platform === 'win32' ? 'program.exe' : 'program')
);

const combineOutput = (stdout, stderr) => [stdout, stderr].filter(Boolean).join(stdout && stderr ? '\n' : '');

const createLogEntries = (stdout, stderr) => [
  ...(stdout ? [{ type: 'stdout', text: stdout }] : []),
  ...(stderr ? [{ type: 'stderr', text: stderr }] : [])
];

const runProcess = ({
  command,
  args = [],
  cwd,
  stdin = '',
  timeoutMs,
  maxOutputLength = MAX_OUTPUT_LENGTH
}) => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  let stdout = '';
  let stderr = '';
  let outputLength = 0;
  let truncated = false;
  let timedOut = false;

  const child = spawn(command, args, {
    cwd,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });

  const appendOutput = (stream, chunk) => {
    const text = chunk.toString();
    const remaining = maxOutputLength - outputLength;

    if (remaining <= 0) {
      truncated = true;
      return;
    }

    const clipped = text.length > remaining ? text.slice(0, remaining) : text;

    if (stream === 'stdout') {
      stdout += clipped;
    } else {
      stderr += clipped;
    }

    outputLength += clipped.length;

    if (clipped.length < text.length) {
      truncated = true;
    }
  };

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);

  child.stdout.on('data', (chunk) => appendOutput('stdout', chunk));
  child.stderr.on('data', (chunk) => appendOutput('stderr', chunk));

  child.on('error', (error) => {
    clearTimeout(timeoutHandle);
    reject(error);
  });

  child.on('close', (code, signal) => {
    clearTimeout(timeoutHandle);
    const output = combineOutput(stdout.trimEnd(), stderr.trimEnd());

    resolve({
      code,
      signal,
      stdout: stdout.trimEnd(),
      stderr: stderr.trimEnd(),
      output,
      logs: createLogEntries(stdout.trimEnd(), stderr.trimEnd()),
      truncated,
      timedOut,
      executionTimeMs: Date.now() - startedAt
    });
  });

  if (stdin) {
    child.stdin.write(stdin);
  }

  child.stdin.end();
});

const runCommandStep = async ({
  command,
  args,
  cwd,
  stdin,
  timeoutMs,
  maxOutputLength,
  errorName
}) => {
  const result = await runProcess({
    command,
    args,
    cwd,
    stdin,
    timeoutMs,
    maxOutputLength
  });

  if (result.timedOut) {
    return {
      success: false,
      output: result.output,
      logs: result.logs,
      result: null,
      error: {
        name: 'TimeoutError',
        message: `Execution exceeded ${timeoutMs}ms`
      },
      timedOut: true,
      truncated: result.truncated,
      executionTimeMs: result.executionTimeMs
    };
  }

  if (result.code !== 0) {
    return {
      success: false,
      output: result.output,
      logs: result.logs,
      result: null,
      error: {
        name: errorName,
        message: result.stderr || result.stdout || `Process exited with code ${result.code}`
      },
      timedOut: false,
      truncated: result.truncated,
      executionTimeMs: result.executionTimeMs
    };
  }

  return {
    success: true,
    output: result.output,
    logs: result.logs,
    result: null,
    error: null,
    timedOut: false,
    truncated: result.truncated,
    executionTimeMs: result.executionTimeMs
  };
};

const executeJavaScript = (payload) => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  const worker = new Worker(path.join(__dirname, 'codeExecution.worker.js'), {
    workerData: {
      code: payload.code,
      stdin: payload.stdin,
      timeoutMs: payload.timeoutMs,
      maxOutputLength: payload.maxOutputLength || MAX_OUTPUT_LENGTH
    },
    resourceLimits: {
      maxOldGenerationSizeMb: 32,
      maxYoungGenerationSizeMb: 8,
      codeRangeSizeMb: 16,
      stackSizeMb: 1
    }
  });
  let settled = false;
  let timeoutHandle;

  const settle = (value, isError = false) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeoutHandle);

    if (isError) {
      reject(value);
      return;
    }

    resolve(value);
  };

  timeoutHandle = setTimeout(() => {
    worker.terminate();
    settle({
      success: false,
      output: '',
      logs: [],
      result: null,
      error: {
        name: 'TimeoutError',
        message: `Execution exceeded ${payload.timeoutMs}ms`
      },
      timedOut: true,
      truncated: false,
      executionTimeMs: Date.now() - startedAt
    });
  }, payload.timeoutMs + 500);

  worker.once('message', (message) => {
    settle({
      ...message,
      executionTimeMs: message.executionTimeMs || Date.now() - startedAt
    });
  });

  worker.once('error', (error) => {
    settle(error, true);
  });

  worker.once('exit', (code) => {
    if (code !== 0) {
      settle({
        success: false,
        output: '',
        logs: [],
        result: null,
        error: {
          name: 'ExecutionWorkerError',
          message: 'Execution worker stopped before returning a result'
        },
        timedOut: false,
        truncated: false,
        executionTimeMs: Date.now() - startedAt
      });
    }
  });
});

const withTempDir = async (executor) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aclms-code-'));

  try {
    return await executor(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const executeScriptFile = async (payload, config) => withTempDir(async (tempDir) => {
  const filePath = path.join(tempDir, config.filename);
  await fs.writeFile(filePath, config.resolveCode ? config.resolveCode(payload.code) : payload.code, 'utf8');
  const commandConfig = typeof config.getCommand === 'function' ? config.getCommand() : config;

  return runCommandStep({
    command: commandConfig.command,
    args: [...(commandConfig.args || []), filePath],
    cwd: tempDir,
    stdin: payload.stdin,
    timeoutMs: payload.timeoutMs,
    maxOutputLength: payload.maxOutputLength,
    errorName: 'ExecutionError'
  });
});

const wrapJavaSnippet = (code) => {
  if (/\bpublic\s+static\s+void\s+main\s*\(/.test(code)) {
    return code;
  }

  return `public class Main {
  public static void main(String[] args) throws Exception {
${code}
  }
}`;
};

const getJavaMainClass = (code) => {
  const packageMatch = code.match(/^\s*package\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/m);
  const publicClassMatch = code.match(/\bpublic\s+class\s+([A-Za-z_$][\w$]*)/);
  const classMatch = code.match(/\bclass\s+([A-Za-z_$][\w$]*)/);
  const className = publicClassMatch?.[1] || classMatch?.[1] || 'Main';

  return {
    className,
    runClass: packageMatch ? `${packageMatch[1]}.${className}` : className
  };
};

const executeJava = async (payload) => withTempDir(async (tempDir) => {
  const source = wrapJavaSnippet(payload.code);
  const { className, runClass } = getJavaMainClass(source);
  const sourcePath = path.join(tempDir, `${className}.java`);
  await fs.writeFile(sourcePath, source, 'utf8');

  const compileResult = await runCommandStep({
    command: 'javac',
    args: ['-encoding', 'UTF-8', '-d', tempDir, sourcePath],
    cwd: tempDir,
    timeoutMs: payload.timeoutMs,
    maxOutputLength: payload.maxOutputLength,
    errorName: 'CompilationError'
  });

  if (!compileResult.success) {
    return compileResult;
  }

  return runCommandStep({
    command: 'java',
    args: ['-cp', tempDir, runClass],
    cwd: tempDir,
    stdin: payload.stdin,
    timeoutMs: payload.timeoutMs,
    maxOutputLength: payload.maxOutputLength,
    errorName: 'ExecutionError'
  });
});

const splitPreprocessorLines = (code) => {
  const preprocessorLines = [];
  const bodyLines = [];

  code.replace(/\r\n/g, '\n').split('\n').forEach((line) => {
    if (/^\s*#/.test(line)) {
      preprocessorLines.push(line);
    } else {
      bodyLines.push(line);
    }
  });

  return {
    preprocessor: preprocessorLines.join('\n'),
    body: bodyLines.join('\n')
  };
};

const wrapCCode = (code) => {
  if (/\bmain\s*\(/.test(code)) {
    return code;
  }

  const { preprocessor, body } = splitPreprocessorLines(code);
  const includes = preprocessor || '#include <stdio.h>';

  return `${includes}
int main(void) {
${body}
  return 0;
}`;
};

const wrapCppCode = (code) => {
  if (/\bmain\s*\(/.test(code)) {
    return code;
  }

  const { preprocessor, body } = splitPreprocessorLines(code);
  const includes = preprocessor || '#include <iostream>';

  return `${includes}
using namespace std;
int main() {
${body}
  return 0;
}`;
};

const executeCompiledLanguage = async (payload, config) => withTempDir(async (tempDir) => {
  const sourcePath = path.join(tempDir, config.filename);
  const executablePath = getExecutablePath(tempDir);
  await fs.writeFile(sourcePath, config.resolveCode(payload.code), 'utf8');

  const compileResult = await runCommandStep({
    command: config.compiler,
    args: [...config.compileArgs(sourcePath), '-o', executablePath],
    cwd: tempDir,
    timeoutMs: payload.timeoutMs,
    maxOutputLength: payload.maxOutputLength,
    errorName: 'CompilationError'
  });

  if (!compileResult.success) {
    return compileResult;
  }

  return runCommandStep({
    command: executablePath,
    cwd: tempDir,
    stdin: payload.stdin,
    timeoutMs: payload.timeoutMs,
    maxOutputLength: payload.maxOutputLength,
    errorName: 'ExecutionError'
  });
});

const wrapGoCode = (code) => {
  if (/^\s*package\s+main\b/m.test(code)) {
    return code;
  }

  return `package main
import "fmt"
func main() {
${code}
}`;
};

const wrapRustCode = (code) => {
  if (/\bfn\s+main\s*\(/.test(code)) {
    return code;
  }

  return `fn main() {
${code}
}`;
};

const normalizePhpCode = (code) => (/^\s*<\?php/.test(code) ? code : `<?php\n${code}`);

const executeDotnet = async (payload) => withTempDir(async (tempDir) => {
  const projectPath = path.join(tempDir, 'Runner.csproj');
  const programPath = path.join(tempDir, 'Program.cs');

  await fs.writeFile(projectPath, `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>disable</Nullable>
  </PropertyGroup>
</Project>`, 'utf8');
  await fs.writeFile(programPath, payload.code, 'utf8');

  return runCommandStep({
    command: 'dotnet',
    args: ['run', '--project', projectPath],
    cwd: tempDir,
    stdin: payload.stdin,
    timeoutMs: payload.timeoutMs,
    maxOutputLength: payload.maxOutputLength,
    errorName: 'ExecutionError'
  });
});

const LANGUAGE_RUNNERS = {
  javascript: {
    displayName: 'JavaScript',
    aliases: ['js', 'javascript', 'node', 'nodejs'],
    requiredCommands: ['node'],
    isAvailable: () => true,
    execute: executeJavaScript
  },
  python: {
    displayName: 'Python',
    aliases: ['py', 'python', 'python3', 'py3'],
    requiredCommands: ['python3 or python or py'],
    isAvailable: () => Boolean(getPythonCommand()),
    execute: (payload) => executeScriptFile(payload, {
      filename: 'main.py',
      getCommand: getPythonCommand
    })
  },
  java: {
    displayName: 'Java',
    aliases: ['java'],
    requiredCommands: ['javac', 'java'],
    isAvailable: () => commandExists('javac', ['-version']) && commandExists('java', ['-version']),
    execute: executeJava
  },
  c: {
    displayName: 'C',
    aliases: ['c', 'gcc'],
    requiredCommands: ['gcc'],
    isAvailable: () => commandExists('gcc', ['--version']),
    execute: (payload) => executeCompiledLanguage(payload, {
      compiler: 'gcc',
      filename: 'main.c',
      resolveCode: wrapCCode,
      compileArgs: (sourcePath) => ['-std=c11', '-O0', sourcePath]
    })
  },
  cpp: {
    displayName: 'C++',
    aliases: ['cpp', 'c++', 'cxx', 'g++'],
    requiredCommands: ['g++'],
    isAvailable: () => commandExists('g++', ['--version']),
    execute: (payload) => executeCompiledLanguage(payload, {
      compiler: 'g++',
      filename: 'main.cpp',
      resolveCode: wrapCppCode,
      compileArgs: (sourcePath) => ['-std=c++17', '-O0', sourcePath]
    })
  },
  csharp: {
    displayName: 'C#',
    aliases: ['cs', 'c#', 'csharp', 'dotnet'],
    requiredCommands: ['dotnet SDK'],
    isAvailable: () => commandExists('dotnet', ['--info']),
    execute: executeDotnet
  },
  php: {
    displayName: 'PHP',
    aliases: ['php'],
    requiredCommands: ['php'],
    isAvailable: () => commandExists('php', ['--version']),
    execute: (payload) => executeScriptFile(payload, {
      command: 'php',
      filename: 'main.php',
      resolveCode: normalizePhpCode
    })
  },
  ruby: {
    displayName: 'Ruby',
    aliases: ['rb', 'ruby'],
    requiredCommands: ['ruby'],
    isAvailable: () => commandExists('ruby', ['--version']),
    execute: (payload) => executeScriptFile(payload, {
      command: 'ruby',
      filename: 'main.rb'
    })
  },
  go: {
    displayName: 'Go',
    aliases: ['go', 'golang'],
    requiredCommands: ['go'],
    isAvailable: () => commandExists('go', ['version']),
    execute: (payload) => executeScriptFile(payload, {
      command: 'go',
      args: ['run'],
      filename: 'main.go',
      resolveCode: wrapGoCode
    })
  },
  rust: {
    displayName: 'Rust',
    aliases: ['rs', 'rust', 'rustc'],
    requiredCommands: ['rustc'],
    isAvailable: () => commandExists('rustc', ['--version']),
    execute: (payload) => executeCompiledLanguage(payload, {
      compiler: 'rustc',
      filename: 'main.rs',
      resolveCode: wrapRustCode,
      compileArgs: (sourcePath) => [sourcePath]
    })
  }
};

const SUPPORTED_LANGUAGE_ALIASES = new Map();
Object.entries(LANGUAGE_RUNNERS).forEach(([language, runner]) => {
  SUPPORTED_LANGUAGE_ALIASES.set(language, language);
  runner.aliases.forEach((alias) => SUPPORTED_LANGUAGE_ALIASES.set(alias, language));
});

const getCodeExecutionLimits = () => ({
  minTimeoutMs: MIN_TIMEOUT_MS,
  defaultTimeoutMs: Math.min(Math.max(DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS),
  maxTimeoutMs: MAX_TIMEOUT_MS,
  maxCodeLength: MAX_CODE_LENGTH,
  maxInputLength: MAX_INPUT_LENGTH,
  maxOutputLength: MAX_OUTPUT_LENGTH
});

const normalizeLanguage = (language) => {
  const normalized = String(language || 'javascript').trim().toLowerCase();
  return SUPPORTED_LANGUAGE_ALIASES.get(normalized) || normalized;
};

const getCodeExecutionLanguageSupport = (language) => {
  const normalizedLanguage = normalizeLanguage(language);
  const runner = LANGUAGE_RUNNERS[normalizedLanguage];

  if (!runner) {
    return {
      language: normalizedLanguage,
      known: false,
      available: false,
      displayName: normalizedLanguage,
      aliases: [],
      requiredCommands: []
    };
  }

  return {
    language: normalizedLanguage,
    known: true,
    available: runner.isAvailable(),
    displayName: runner.displayName,
    aliases: runner.aliases,
    requiredCommands: runner.requiredCommands
  };
};

const getCodeExecutionLanguageOptions = () => Object.keys(LANGUAGE_RUNNERS)
  .map(getCodeExecutionLanguageSupport);

const getSupportedLanguages = () => getCodeExecutionLanguageOptions()
  .filter((language) => language.available)
  .map((language) => language.language);

const isSupportedLanguage = (language) => getCodeExecutionLanguageSupport(language).available;

const resolveCodeValue = (body = {}) => {
  const candidates = [
    body.code,
    body.source,
    body.sourceCode,
    body.content
  ];

  return candidates.find((value) => typeof value === 'string');
};

const resolveInputValue = (body = {}) => {
  const input = body.stdin ?? body.input ?? '';

  if (input === null || input === undefined) {
    return '';
  }

  return typeof input === 'string' ? input : String(input);
};

const normalizeTimeoutMs = (timeoutMs) => {
  const limits = getCodeExecutionLimits();

  if (timeoutMs === undefined || timeoutMs === null || timeoutMs === '') {
    return limits.defaultTimeoutMs;
  }

  const parsed = Number(timeoutMs);

  if (!Number.isInteger(parsed)) {
    return limits.defaultTimeoutMs;
  }

  return Math.min(Math.max(parsed, limits.minTimeoutMs), limits.maxTimeoutMs);
};

const resolveCodeExecutionPayload = (body = {}) => ({
  code: resolveCodeValue(body),
  language: normalizeLanguage(body.language),
  stdin: resolveInputValue(body),
  timeoutMs: normalizeTimeoutMs(body.timeoutMs),
  maxOutputLength: MAX_OUTPUT_LENGTH
});

const executeCode = async (payload) => {
  const runner = LANGUAGE_RUNNERS[payload.language];

  if (!runner || !runner.isAvailable()) {
    const support = getCodeExecutionLanguageSupport(payload.language);
    return {
      success: false,
      output: '',
      logs: [],
      result: null,
      error: {
        name: 'UnsupportedLanguageError',
        message: support.known
          ? `${support.displayName} execution is not available on this server`
          : `Unsupported language: ${payload.language}`
      },
      timedOut: false,
      truncated: false,
      executionTimeMs: 0
    };
  }

  return runner.execute(payload);
};

module.exports = {
  executeCode,
  getCodeExecutionLanguageOptions,
  getCodeExecutionLanguageSupport,
  getCodeExecutionLimits,
  getSupportedLanguages,
  isSupportedLanguage,
  resolveCodeExecutionPayload
};
