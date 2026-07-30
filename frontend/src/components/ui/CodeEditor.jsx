import React, { useMemo } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

if (typeof globalThis !== 'undefined') {
  globalThis.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') return new jsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
      if (label === 'typescript' || label === 'javascript') return new tsWorker();
      return new editorWorker();
    },
  };
}

loader.config({ monaco });

const inferMonacoLanguage = (raw) => {
  const lang = String(raw || '').trim().toLowerCase();
  if (!lang) return 'javascript';
  if (['js', 'javascript', 'jsx', 'node'].includes(lang)) return 'javascript';
  if (['ts', 'typescript', 'tsx'].includes(lang)) return 'typescript';
  if (['html', 'htm'].includes(lang)) return 'html';
  if (['css', 'scss', 'less'].includes(lang)) return 'css';
  if (['json'].includes(lang)) return 'json';
  if (['py', 'python'].includes(lang)) return 'python';
  if (['java'].includes(lang)) return 'java';
  if (['c'].includes(lang)) return 'c';
  if (['cpp', 'c++'].includes(lang)) return 'cpp';
  if (['sh', 'bash', 'shell'].includes(lang)) return 'shell';
  if (['sql'].includes(lang)) return 'sql';
  if (['md', 'markdown'].includes(lang)) return 'markdown';
  return lang;
};

const CodeEditor = ({
  value,
  onChange,
  language = 'js',
  height = 220,
  readOnly = false,
  className = '',
}) => {
  const monacoLanguage = useMemo(() => inferMonacoLanguage(language), [language]);

  return (
    <div className={`rounded-xl border border-gray-200 overflow-hidden bg-white ${className}`}>
      <Editor
        height={height}
        language={monacoLanguage}
        value={value ?? ''}
        onChange={(next) => onChange?.(next ?? '')}
        loading={<div className="px-4 py-3 text-sm text-gray-500">Loading editor...</div>}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          renderLineHighlight: 'line',
          fixedOverflowWidgets: true,
        }}
      />
    </div>
  );
};

export default CodeEditor;

