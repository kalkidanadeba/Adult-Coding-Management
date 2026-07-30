import React, { useEffect, useId, useState } from 'react';
import { FaPlay, FaTrashAlt } from 'react-icons/fa';
import CodeEditor from './CodeEditor';
import { studentApi } from '../../services/studentApi';

const normalizeLang = (raw) => String(raw || '').trim().toLowerCase();

const toScriptLiteral = (value) => JSON.stringify(String(value ?? '')).replace(/</g, '\\u003c');

const buildSandboxHtml = ({ language, code, sandboxId }) => {
  const lang = normalizeLang(language);
  const safeCode = String(code ?? '');

  if (lang === 'html' || lang === 'htm') {
    return safeCode;
  }

  if (lang === 'css') {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${safeCode}</style>
  </head>
  <body>
    <main class="preview-shell">
      <section class="card">
        <h1>CSS Preview</h1>
        <p>Edit the stylesheet, then run it to see the result here.</p>
        <button type="button">Sample Button</button>
      </section>
    </main>
  </body>
</html>`;
  }

  const codeLiteral = toScriptLiteral(safeCode);
  const sandboxIdLiteral = toScriptLiteral(sandboxId);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <script>
      (function () {
        const post = (type, payload) => {
          try {
            parent.postMessage({ __aclmsSandbox: true, sandboxId: ${sandboxIdLiteral}, type, payload }, '*');
          } catch {}
        };

        const toText = (value) => {
          try {
            if (typeof value === 'string') return value;
            if (value === undefined) return 'undefined';
            if (value === null) return 'null';
            return JSON.stringify(value);
          } catch {
            try { return String(value); } catch { return '[unprintable]'; }
          }
        };

        const wrap = (level, original) => function (...args) {
          post('log', { level, message: args.map(toText).join(' ') });
          return original.apply(console, args);
        };

        console.log = wrap('log', console.log);
        console.info = wrap('info', console.info);
        console.warn = wrap('warn', console.warn);
        console.error = wrap('error', console.error);

        window.addEventListener('error', (event) => {
          post('log', { level: 'error', message: (event && (event.message || event.error && event.error.message)) || 'Runtime error' });
        });

        window.addEventListener('unhandledrejection', (event) => {
          const msg = event && event.reason ? (event.reason.message || toText(event.reason)) : 'Unhandled promise rejection';
          post('log', { level: 'error', message: msg });
        });

        try {
          post('status', { state: 'running' });
          new Function(${codeLiteral})();
          post('status', { state: 'done' });
        } catch (err) {
          post('log', { level: 'error', message: err && err.message ? err.message : 'Error' });
          post('status', { state: 'done' });
        }
      })();
    </script>
  </body>
</html>`;
};

const formatLine = (entry) => {
  const level = entry?.level || 'log';
  const message = String(entry?.message ?? '');
  if (level === 'error') return `Error: ${message}`;
  if (level === 'warn') return `Warn: ${message}`;
  if (level === 'info') return `Info: ${message}`;
  if (level === 'result') return `Result: ${message}`;
  return message;
};

const normalizeBackendLogs = (data) => {
  const logs = Array.isArray(data?.logs) ? data.logs : [];
  const entries = logs
    .map((entry) => ({
      level: entry?.type === 'stderr' || entry?.type === 'error' ? 'error' : entry?.type || 'log',
      message: entry?.text ?? entry?.message ?? '',
    }))
    .filter((entry) => entry.message);

  if (!entries.length && data?.output) {
    entries.push({ level: data?.success === false ? 'error' : 'log', message: data.output });
  }

  if (data?.result !== null && data?.result !== undefined && data?.result !== '') {
    entries.push({ level: 'result', message: data.result });
  }

  if (data?.error?.message) {
    entries.push({ level: 'error', message: data.error.message });
  }

  return entries.length ? entries : [{ level: 'log', message: 'Code executed with no output.' }];
};

const RunnableCodeBlock = ({ language = 'js', code = '' }) => {
  const sandboxId = useId();
  const [draftCode, setDraftCode] = useState(code ?? '');
  const [sandboxHtml, setSandboxHtml] = useState('');
  const [runKey, setRunKey] = useState(0);
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const lang = normalizeLang(language);
  const showPreview = lang === 'html' || lang === 'htm' || lang === 'css';

  useEffect(() => {
    const handler = (event) => {
      const data = event?.data;
      if (!data || data.__aclmsSandbox !== true || data.sandboxId !== sandboxId) return;

      if (data.type === 'log') {
        setOutput((prev) => [...prev, { level: data.payload?.level, message: data.payload?.message }].slice(-500));
      }

      if (data.type === 'status') {
        if (data.payload?.state === 'running') setIsRunning(true);
        if (data.payload?.state === 'done') setIsRunning(false);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sandboxId]);

  const run = async () => {
    setOutput([]);
    setIsRunning(true);

    if (showPreview) {
      setSandboxHtml(buildSandboxHtml({ language, code: draftCode, sandboxId }));
      setRunKey((current) => current + 1);
      return;
    }

    try {
      const data = await studentApi.executeCode({
        language,
        code: draftCode,
        timeoutMs: 5000,
      });
      setOutput(normalizeBackendLogs(data));
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to execute code';
      setOutput([{ level: 'error', message }]);
    } finally {
      setIsRunning(false);
    }
  };

  const clear = () => setOutput([]);

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">{language || 'code'}</span>
          {isRunning ? <span className="text-xs text-primary-700">Running...</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
          >
            <FaPlay aria-hidden="true" /> Run
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FaTrashAlt aria-hidden="true" /> Clear
          </button>
        </div>
      </div>

      <div className="bg-gray-900">
        <CodeEditor value={draftCode} onChange={setDraftCode} language={language} height={240} className="border-0 rounded-none" />
      </div>

      <div className="border-t border-gray-200 bg-white p-4">
        <p className="text-xs font-semibold text-gray-700">Output</p>
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 min-h-15">
          {output.length ? (
            <pre className="whitespace-pre-wrap text-xs text-gray-800 leading-relaxed">{output.map((entry) => formatLine(entry)).join('\n')}</pre>
          ) : (
            <p className="text-sm text-gray-500">Run the code to see output here (console.log).</p>
          )}
        </div>
      </div>

      {showPreview ? (
        <div className="border-t border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold text-gray-700">Preview</p>
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <iframe
              key={runKey}
              title="code-sandbox-preview"
              sandbox="allow-scripts"
              srcDoc={sandboxHtml}
              onLoad={() => setIsRunning(false)}
              className="h-64 w-full bg-white"
            />
          </div>
        </div>
      ) : (
        <iframe
          key={runKey}
          title="code-sandbox"
          sandbox="allow-scripts"
          srcDoc={sandboxHtml}
          onLoad={() => setIsRunning(false)}
          className="hidden"
        />
      )}
    </div>
  );
};

export default RunnableCodeBlock;
