const { normalizeLessonResourcesForResponse } = require('./fileUpload.helpers');

const BLOCK_TYPES = ['text', 'list', 'code'];
const MAX_CONTENT_LENGTH = 50000;

const hasOwnProperty = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeTextValue = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const normalizeBlock = (block, index) => {
  const prefix = `Lesson content block ${index + 1}`;

  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    throw new Error(`${prefix} is invalid`);
  }

  const type = normalizeTextValue(block.type).toLowerCase();
  if (!BLOCK_TYPES.includes(type)) {
    throw new Error(`${prefix} must have one of these types: ${BLOCK_TYPES.join(', ')}`);
  }

  if (type === 'text') {
    const content = normalizeTextValue(block.content ?? block.text);
    if (!content) {
      throw new Error(`${prefix} text content is required`);
    }

    return {
      type,
      content
    };
  }

  if (type === 'list') {
    if (!Array.isArray(block.items) || block.items.length === 0) {
      throw new Error(`${prefix} must include at least one list item`);
    }

    const items = block.items
      .map((item) => normalizeTextValue(String(item ?? '')))
      .filter(Boolean);

    if (items.length === 0) {
      throw new Error(`${prefix} must include at least one valid list item`);
    }

    return {
      type,
      items,
      ordered: Boolean(block.ordered)
    };
  }

  const content = normalizeTextValue(block.content ?? block.code);
  if (!content) {
    throw new Error(`${prefix} code content is required`);
  }

  const language = normalizeTextValue(block.language);

  return {
    type,
    content,
    ...(language ? { language } : {})
  };
};

const serializeLessonBlocksToText = (blocks) => blocks
  .map((block) => {
    if (block.type === 'text') {
      return block.content;
    }

    if (block.type === 'list') {
      return block.items
        .map((item, itemIndex) => (block.ordered ? `${itemIndex + 1}. ${item}` : `- ${item}`))
        .join('\n');
    }

    const label = block.language ? `[code:${block.language}]` : '[code]';
    return `${label}\n${block.content}`;
  })
  .join('\n\n')
  .trim();

const normalizeLessonContentInput = (input) => {
  if (typeof input === 'string') {
    const content = normalizeTextValue(input);
    if (!content) {
      throw new Error('Lesson content is required');
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      throw new Error(`Lesson content cannot exceed ${MAX_CONTENT_LENGTH} characters`);
    }

    return {
      content,
      contentBlocks: [
        {
          type: 'text',
          content
        }
      ]
    };
  }

  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('Lesson content must be a non-empty string or block array');
  }

  const contentBlocks = input.map(normalizeBlock);
  const content = serializeLessonBlocksToText(contentBlocks);

  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error(`Lesson content cannot exceed ${MAX_CONTENT_LENGTH} characters`);
  }

  return {
    content,
    contentBlocks
  };
};

const resolveLessonContentFields = (body, options = {}) => {
  const { required = false } = options;
  const hasContentBlocks = hasOwnProperty(body, 'contentBlocks');
  const hasContent = hasOwnProperty(body, 'content');

  if (!hasContentBlocks && !hasContent) {
    if (required) {
      throw new Error('Lesson content is required');
    }

    return null;
  }

  if (hasContentBlocks) {
    return normalizeLessonContentInput(body.contentBlocks);
  }

  return normalizeLessonContentInput(body.content);
};

const ensureLessonContentBlocks = (lessonLike) => {
  const lesson = typeof lessonLike?.toObject === 'function'
    ? lessonLike.toObject()
    : { ...lessonLike };
  const contentText = typeof lesson.content === 'string' ? lesson.content : '';

  let contentBlocks = [];

  if (Array.isArray(lesson.contentBlocks) && lesson.contentBlocks.length > 0) {
    contentBlocks = normalizeLessonContentInput(lesson.contentBlocks).contentBlocks;
  } else if (normalizeTextValue(contentText)) {
    contentBlocks = normalizeLessonContentInput(lesson.content).contentBlocks;
  }

  return {
    ...lesson,
    content: contentBlocks,
    contentText,
    contentBlocks,
    resources: normalizeLessonResourcesForResponse(lesson.resources)
  };
};

module.exports = {
  BLOCK_TYPES,
  ensureLessonContentBlocks,
  normalizeLessonContentInput,
  resolveLessonContentFields,
  serializeLessonBlocksToText
};
