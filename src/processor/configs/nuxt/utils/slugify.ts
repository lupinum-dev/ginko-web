interface SlugifyOptions {
  lowercase?: boolean;
  removeStopWords?: boolean;
  separator?: string;
  maxLength?: number;
  stripNumbers?: boolean;
  preserveLeadingNumbers?: boolean;
  preserveCase?: boolean;
  customReplacements?: [string, string][];
}

const defaultOptions: SlugifyOptions = {
  lowercase: true,
  removeStopWords: true,
  separator: '-',
  maxLength: 100,
  stripNumbers: false,
  preserveLeadingNumbers: true,
  preserveCase: false,
  customReplacements: []
};

// German character mappings
const germanCharMap: { [key: string]: string } = {
  'ä': 'ae',
  'ö': 'oe',
  'ü': 'ue',
  'ß': 'ss',
  'Ä': 'Ae',
  'Ö': 'Oe',
  'Ü': 'Ue'
};

// Common stop words in German and English
const stopWords = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'by'
]);

// Special characters mapping
const specialCharsMap: { [key: string]: string } = {
  'æ': 'ae',
  'œ': 'oe',
  'ø': 'o',
  'å': 'a',
  'é': 'e',
  'è': 'e',
  'ê': 'e',
  'ë': 'e',
  'á': 'a',
  'à': 'a',
  'â': 'a',
  'ã': 'a',
  'í': 'i',
  'ì': 'i',
  'î': 'i',
  'ï': 'i',
  'ó': 'o',
  'ò': 'o',
  'ô': 'o',
  'õ': 'o',
  'ú': 'u',
  'ù': 'u',
  'û': 'u',
  'ý': 'y',
  'ÿ': 'y',
  'ñ': 'n',
  'ç': 'c',
  '@': 'at',
  '&': 'and',
  '$': 's',
  '€': 'euro',
  '£': 'pound',
  '¥': 'yen'
};

function replaceSpecialChars(str: string): string {
  return str
    .split('')
    .map(char => germanCharMap[char] || specialCharsMap[char] || char)
    .join('');
}

function removeStopWordsFromString(str: string, separator: string): string {
  return str
    .split(separator)
    .filter(word => !stopWords.has(word.toLowerCase()))
    .join(separator);
}

export function slugify(input: string, options: SlugifyOptions = {}): string {
  // Merge options with defaults
  const opts = { ...defaultOptions, ...options };

  // Handle empty input
  if (!input) return '';

  let slug = input.trim();

  // Apply custom replacements first
  if (opts.customReplacements) {
    for (const [from, to] of opts.customReplacements) {
      slug = slug.replace(new RegExp(from, 'g'), to);
    }
  }

  // Replace special characters
  slug = replaceSpecialChars(slug);

  // Convert to lowercase if needed
  if (opts.lowercase && !opts.preserveCase) {
    slug = slug.toLowerCase();
  }

  // Remove stop words if enabled
  if (opts.removeStopWords) {
    slug = removeStopWordsFromString(slug, ' ');
  }

  // Handle numbers
  if (opts.stripNumbers) {
    slug = slug.replace(/[0-9]/g, '');
  } else if (!opts.preserveLeadingNumbers) {
    slug = slug.replace(/^[0-9]+/, '');
  }

  // Replace spaces and special characters with separator
  slug = slug
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove invalid chars
    .replace(/\s+/g, opts.separator!) // Replace spaces with separator
    .replace(/-+/g, opts.separator!) // Replace multiple separators with single
    .replace(/^-+/, '') // Trim separator from start
    .replace(/-+$/, ''); // Trim separator from end

  // Apply maximum length if specified
  if (opts.maxLength && slug.length > opts.maxLength) {
    // Trim at separator if possible
    const lastSeparatorIndex = slug.lastIndexOf(opts.separator!, opts.maxLength);
    if (lastSeparatorIndex > 0) {
      slug = slug.substr(0, lastSeparatorIndex);
    } else {
      slug = slug.substr(0, opts.maxLength);
    }
  }

  return slug;
}