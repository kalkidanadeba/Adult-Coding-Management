const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : null);

const toTrimmedString = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const getFirstPresent = (obj, keys) => {
  for (const key of keys) {
    if (obj?.[key] != null) return obj[key];
  }

  return undefined;
};

const CODE_BLOCK_TYPES = new Set([
  'code',
  'code-block',
  'code_block',
  'codeblock',
  'code snippet',
  'snippet',
  'pre',
  'preformatted',
  'monaco',
  'editor',
]);

const CODE_VALUE_KEYS = [
  'code',
  'snippet',
  'codeBlock',
  'code_block',
  'codeSnippet',
  'code_snippet',
  'sourceCode',
  'source_code',
  'sampleCode',
  'sample_code',
];

const CODE_LANGUAGE_KEYS = [
  'language',
  'lang',
  'syntax',
  'mode',
  'codeLanguage',
  'code_language',
  'programmingLanguage',
  'programming_language',
];

const inferCodeLanguage = (value) => {
  const text = toTrimmedString(value);
  if (!text) return 'js';

  if (/^\s*(<!doctype|<html|<body|<[a-z][\w:-]*(\s|>|\/>))/i.test(text)) return 'html';
  if (/^\s*[.#]?[a-z][\w-]*(\s+[.#]?[a-z][\w-]*)*\s*{\s*$/im.test(text)) return 'css';
  if (/^\s*(select|insert|update|delete)\b[\s\S]*\b(from|into|set)\b/im.test(text)) return 'sql';
  if (/^\s*(def|class)\s+\w+.*:/m.test(text) || /\bprint\s*\(/.test(text)) return 'python';

  return 'js';
};

const looksLikeCodeText = (value) => {
  const text = toTrimmedString(value);
  if (!text) return false;

  const lines = text.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean);
  const codeLineCount = lines.filter((line) => /[;{}]$/.test(line) || /^(const|let|var|function|if|for|while|return|import|export)\b/.test(line)).length;

  return (
    /\bconsole\.(log|info|warn|error)\s*\(/.test(text) ||
    /\b(const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(text) ||
    /\bfunction\s+[A-Za-z_$][\w$]*\s*\(/.test(text) ||
    /=>\s*[{(]?/.test(text) ||
    /^\s*(import|export)\s.+from\s+/m.test(text) ||
    /^\s*(if|for|while|switch)\s*\(.+\)\s*{/m.test(text) ||
    /^\s*(<!doctype|<html|<body|<[a-z][\w:-]*(\s|>|\/>))/i.test(text) ||
    /^\s*[.#]?[a-z][\w-]*(\s+[.#]?[a-z][\w-]*)*\s*{\s*$/im.test(text) ||
    /^\s*(select|insert|update|delete)\b[\s\S]*\b(from|into|set)\b/im.test(text) ||
    /^\s*(def|class)\s+\w+.*:/m.test(text) ||
    (lines.length > 1 && codeLineCount >= 2)
  );
};

const parseJsonString = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  const looksStructured =
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'));

  if (!looksStructured) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const unwrapCodeFence = (value) => {
  const text = toTrimmedString(value);
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const firstLine = lines[0]?.trim() || '';

  if (!/^(```|~~~)/.test(firstLine)) return null;

  const fence = firstLine.slice(0, 3);
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim().startsWith(fence));
  if (closingIndex < 0) return null;

  const code = lines.slice(1, closingIndex).join('\n').trimEnd();
  if (!code.trim()) return null;

  return {
    code,
    language: firstLine.slice(3).trim(),
  };
};

const isDataUrl = (value) => /^data:/i.test(toTrimmedString(value));

const getDataUrlMimeType = (value) => {
  const match = toTrimmedString(value).match(/^data:([^;,]+)[;,]/i);
  return match?.[1]?.trim() || '';
};

const getFilenameFromUrl = (value) => {
  const raw = toTrimmedString(value);
  if (!raw || isDataUrl(raw)) return '';

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : '';
  } catch {
    return '';
  }
};

const splitListItems = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter(Boolean);
  }

  if (typeof value !== 'string') return [];

  const parsed = parseJsonString(value);
  if (parsed !== value) return splitListItems(parsed);

  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const newlineItems = normalized
    .split('\n')
    .map((item) => item.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean);
  if (newlineItems.length > 1) return newlineItems;

  const commaItems = normalized
    .split(/\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (commaItems.length > 1) return commaItems;

  return [normalized];
};

const createListBlock = (value) => {
  const items = splitListItems(value);
  return items.length ? { type: 'list', items, value: items } : null;
};

const createCodeBlock = (value, language = '') => {
  const rawCode = Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === 'string') return item;
          const obj = asObject(item);
          return obj ? toTrimmedString(obj.text ?? obj.value ?? obj.content ?? obj.code) : '';
        })
        .filter(Boolean)
        .join('\n')
        .trim()
    : toTrimmedString(value);
  const fenced = unwrapCodeFence(rawCode);
  const code = fenced?.code ?? rawCode;
  if (!code) return null;

  const normalizedLanguage = toTrimmedString(language) || fenced?.language || inferCodeLanguage(code);
  return {
    type: 'code',
    language: normalizedLanguage,
    code,
    value: code,
  };
};

const parsePlainTextBlocks = (value) => {
  if (typeof value !== 'string') return [];

  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraphLines = [];
  let listItems = [];

  const flushParagraph = () => {
    const text = paragraphLines.join('\n').trim();
    if (text) {
      const codeBlock = looksLikeCodeText(text) ? createCodeBlock(text) : null;
      blocks.push(codeBlock || { type: 'text', text, value: text });
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length) blocks.push({ type: 'list', items: listItems, value: listItems });
    listItems = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      flushParagraph();
      flushList();

      const fence = trimmed.slice(0, 3);
      const language = trimmed.slice(3).trim() || 'js';
      const codeLines = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith(fence)) {
        codeLines.push(lines[index]);
        index += 1;
      }

      const code = codeLines.join('\n').trimEnd();
      if (code) {
        blocks.push({
          type: 'code',
          language,
          code,
          value: code,
        });
      }
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s*(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1].trim());
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (listItems.length) flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
};

const normalizeLessonBlock = (block) => {
  if (block == null) return [];

  if (typeof block === 'string') {
    const parsed = parseJsonString(block);
    if (parsed !== block) return normalizeLessonBlock(parsed);
    return parsePlainTextBlocks(block);
  }

  if (Array.isArray(block)) {
    return block.flatMap((item) => normalizeLessonBlock(item));
  }

  const obj = asObject(block);
  if (!obj) return [];

  const type = toTrimmedString(obj.type || obj.kind || obj.blockType).toLowerCase();
  const language = getFirstPresent(obj, CODE_LANGUAGE_KEYS);
  const codeValue = getFirstPresent(obj, CODE_VALUE_KEYS);
  const textValue = obj.value ?? obj.text ?? obj.content ?? obj.body;
  const typeHint = [type, obj.title, obj.label, obj.name]
    .map((item) => toTrimmedString(item).toLowerCase())
    .filter(Boolean)
    .join(' ');
  const hasCodeHint = /\b(code|snippet|program|script)\b/.test(typeHint);
  const codeLikeText = looksLikeCodeText(textValue);

  if (
    CODE_BLOCK_TYPES.has(type) ||
    codeValue != null ||
    (language != null && textValue != null) ||
    (hasCodeHint && textValue != null) ||
    codeLikeText
  ) {
    const codeBlock = createCodeBlock(codeValue ?? textValue, language);
    return codeBlock ? [codeBlock] : [];
  }

  if (Array.isArray(obj.blocks)) return normalizeLessonBlock(obj.blocks);
  if (Array.isArray(obj.content)) return normalizeLessonBlock(obj.content);

  if (
    type === 'list' ||
    type === 'bullets' ||
    type === 'bullet' ||
    type === 'unordered-list' ||
    type === 'ordered-list' ||
    obj.items != null ||
    obj.list != null ||
    obj.bullets != null
  ) {
    const listBlock = createListBlock(obj.items ?? obj.list ?? obj.bullets ?? obj.value ?? obj.text ?? obj.content);
    return listBlock ? [listBlock] : [];
  }

  const textSource = obj.text ?? obj.value ?? obj.content ?? obj.description;
  if (textSource != null) {
    const parsedStructured = parseJsonString(textSource);
    if (parsedStructured !== textSource) return normalizeLessonBlock(parsedStructured);

    const parsed = parsePlainTextBlocks(String(textSource));
    if (parsed.length) return parsed;
  }

  return [];
};

export const getLessonContentSource = (lesson) =>
  lesson?.content ??
  lesson?.contentBlocks ??
  lesson?.content_blocks ??
  lesson?.blocks ??
  lesson?.text_content ??
  lesson?.textContent ??
  lesson?.lessonContent ??
  lesson?.lessonNotes ??
  lesson?.lesson_notes ??
  lesson?.notes ??
  lesson?.note ??
  lesson?.body ??
  (getFirstPresent(lesson, CODE_VALUE_KEYS.filter((key) => key !== 'code')) != null
    ? {
        type: 'code',
        language: getFirstPresent(lesson, CODE_LANGUAGE_KEYS),
        code: getFirstPresent(lesson, CODE_VALUE_KEYS.filter((key) => key !== 'code')),
      }
    : null) ??
  null;

export const normalizeLessonContent = (lessonOrContent) => {
  const contentSource =
    asObject(lessonOrContent) && !Array.isArray(lessonOrContent) ? getLessonContentSource(lessonOrContent) : lessonOrContent;

  return normalizeLessonBlock(contentSource);
};

export const formatLessonBlocksForEditor = (blocks) => {
  if (!Array.isArray(blocks)) return '';

  const parts = [];

  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      const text = block.text.trim();
      if (text) parts.push(text);
      continue;
    }

    if (block?.type === 'list' && Array.isArray(block.items)) {
      const lines = block.items
        .map((item) => String(item).trim())
        .filter(Boolean)
        .map((item) => `- ${item}`);
      if (lines.length) parts.push(lines.join('\n'));
    }
  }

  return parts.join('\n\n');
};

export const buildLessonContentFromEditor = ({ textBlock = '', listBlock = '', codeLanguage = 'js', codeBlock = '' } = {}) => {
  const content = parsePlainTextBlocks(textBlock);

  const extraList = createListBlock(listBlock);
  if (extraList) content.push(extraList);

  const codeBody = toTrimmedString(codeBlock);
  if (codeBody) {
    content.push({
      type: 'code',
      language: toTrimmedString(codeLanguage) || 'js',
      code: codeBody,
      value: codeBody,
    });
  }

  return content;
};

export const getLessonEditorFields = (lesson) => {
  const blocks = normalizeLessonContent(lesson);

  const textBlock = formatLessonBlocksForEditor(blocks);
  const listBlock = '';

  const firstCodeBlock = blocks.find((block) => block?.type === 'code' && typeof block.code === 'string');

  return {
    blocks,
    textBlock,
    listBlock,
    codeLanguage: firstCodeBlock?.language || 'js',
    codeBlock: firstCodeBlock?.code || '',
  };
};

export const getLessonVideoUrl = (lesson) => {
  const raw = lesson?.videoUrl ?? lesson?.video_url ?? lesson?.video ?? lesson?.videoLink ?? lesson?.video_link ?? '';

  if (typeof raw === 'string') return raw.trim();

  if (raw && typeof raw === 'object') {
    return toTrimmedString(raw.url ?? raw.src ?? raw.href);
  }

  return '';
};

const isResourceStringFile = (value) => {
  const url = toTrimmedString(value);
  if (!url) return false;
  if (isDataUrl(url)) return true;
  if (/^(?:https?:\/\/)/i.test(url)) {
    return /\.(pdf|docx?|pptx?|xlsx?|xls|csv|txt|png|jpe?g|webp|gif|mp3|wav|m4a|mp4|webm)(?:[?#].*)?$/i.test(url);
  }
  return /^(?:\/|\.\/|\.\.\/)/.test(url);
};

const normalizeLessonResourceItem = (item, index = 0, sourceType = 'string') => {
  if (item == null) return null;

  if (typeof item === 'string') {
    const parsed = parseJsonString(item);
    if (parsed !== item) return normalizeLessonResourceItem(parsed, index, 'encoded');

    const url = toTrimmedString(item);
    if (!url) return null;

    const isFile = isResourceStringFile(url);
    return {
      id: `resource-${index + 1}`,
      kind: isFile ? 'file' : 'link',
      name: getFilenameFromUrl(url) || `${isFile ? 'Attachment' : 'Resource'} ${index + 1}`,
      url,
      mimeType: '',
      size: null,
      sourceType,
    };
  }

  const obj = asObject(item);
  if (!obj) return null;

  const url = toTrimmedString(obj.url ?? obj.href ?? obj.src ?? obj.dataUrl ?? obj.value ?? obj.link);
  if (!url) return null;

  const normalizedKind = toTrimmedString(obj.kind ?? obj.resourceType ?? obj.resource_type).toLowerCase();
  const mimeType = toTrimmedString(obj.mimeType ?? obj.mime_type ?? obj.fileType ?? obj.file_type) || getDataUrlMimeType(url);
  const name =
    toTrimmedString(obj.name ?? obj.title ?? obj.label ?? obj.filename ?? obj.fileName) ||
    getFilenameFromUrl(url) ||
    `${normalizedKind === 'file' || isDataUrl(url) ? 'Attachment' : 'Resource'} ${index + 1}`;
  const parsedSize = Number(obj.size ?? obj.fileSize ?? obj.file_size);
  const size = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : null;
  const kind = normalizedKind === 'file' || isDataUrl(url) ? 'file' : 'link';

  return {
    id: `resource-${index + 1}`,
    kind,
    name,
    url,
    mimeType,
    size,
    sourceType,
  };
};

export const normalizeLessonResources = (lessonOrResources) => {
  const resourceSource =
    asObject(lessonOrResources) && !Array.isArray(lessonOrResources)
      ? lessonOrResources?.resources ??
        lessonOrResources?.resourceLinks ??
        lessonOrResources?.resource_links ??
        lessonOrResources?.attachments ??
        lessonOrResources?.files ??
        null
      : lessonOrResources;

  if (resourceSource == null) return [];

  if (Array.isArray(resourceSource)) {
    return resourceSource
      .map((item, index) => normalizeLessonResourceItem(item, index))
      .filter(Boolean);
  }

  if (typeof resourceSource === 'string') {
    const parsed = parseJsonString(resourceSource);
    if (parsed !== resourceSource) return normalizeLessonResources(parsed);

    return resourceSource
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((item, index) => normalizeLessonResourceItem(item, index))
      .filter(Boolean);
  }

  const singleResource = normalizeLessonResourceItem(resourceSource, 0, 'object');
  return singleResource ? [singleResource] : [];
};

const normalizeResourceUrl = (value) => {
  const raw = toTrimmedString(value);
  if (!raw) return '';
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(raw)) return raw;

  try {
    return new URL(raw.startsWith('/') ? raw : `/${raw}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').href;
  } catch {
    return raw;
  }
};

export const serializeLessonUploadedResource = (resource) => {
  const url = normalizeResourceUrl(resource?.url);
  const name = toTrimmedString(resource?.name);
  const mimeType = toTrimmedString(resource?.mimeType);
  const parsedSize = Number(resource?.size);
  const size = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : undefined;

  if (!url || !name) return '';

  return JSON.stringify({
    kind: 'file',
    name,
    url,
    ...(mimeType ? { mimeType } : {}),
    ...(size ? { size } : {}),
  });
};

export const getEmbeddableVideoUrl = (rawUrl) => {
  const url = toTrimmedString(rawUrl);
  if (!url) return '';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;

      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'embed' && pathParts[1]) return `https://www.youtube.com/embed/${pathParts[1]}`;
      if (pathParts[0] === 'shorts' && pathParts[1]) return `https://www.youtube.com/embed/${pathParts[1]}`;
    }

    if (host === 'youtu.be') {
      const videoId = parsed.pathname.split('/').filter(Boolean)[0];
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const videoId = parsed.pathname.split('/').filter(Boolean).pop();
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(parsed.pathname)) return url;
  } catch {
    return '';
  }

  return '';
};

export const isDirectVideoFile = (rawUrl) => /\.(mp4|webm|ogg)(\?.*)?$/i.test(toTrimmedString(rawUrl));
