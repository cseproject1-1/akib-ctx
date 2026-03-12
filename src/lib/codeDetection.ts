/**
 * @file codeDetection.ts
 * @description Advanced multi-language code detection and formatting system.
 */

export interface CodeDetectionResult {
  isCode: boolean;
  language: string;
  confidence: number;
  formattedText: string;
}

const LANGUAGE_PATTERNS: Record<string, { regex: RegExp; weight: number }[]> = {
  javascript: [
    { regex: /\b(const|let|var)\s+\w+\s*=/g, weight: 10 },
    { regex: /\bfunction\s+\w*\s*\(.*\)\s*\{/g, weight: 15 },
    { regex: /=>\s*\{/g, weight: 8 },
    { regex: /\bconsole\.log\(/g, weight: 10 },
    { regex: /\bexport\s+(default\s+)?(const|let|var|function|class)/g, weight: 12 },
    { regex: /\bimport\s+.*\s+from\s+['"].*['"]/g, weight: 12 },
    { regex: /\b(async|await|Promise|yield)\b/g, weight: 8 },
  ],
  typescript: [
    { regex: /:\s*(string|number|boolean|any|void|never|unknown)\b/g, weight: 15 },
    { regex: /\binterface\s+\w+\s*\{/g, weight: 15 },
    { regex: /\btype\s+\w+\s*=/g, weight: 15 },
    { regex: /<[A-Z]\w*(\s*,\s*[A-Z]\w*)*>/g, weight: 10 },
    { regex: /\bprivate\s+\w+|public\s+\w+|protected\s+\w+/g, weight: 12 },
  ],
  python: [
    { regex: /\bdef\s+\w+\s*\(.*\)\s*:/g, weight: 20 },
    { regex: /\bimport\s+\w+(\s+as\s+\w+)?/g, weight: 10 },
    { regex: /\bfrom\s+\w+\s+import\s+\w+/g, weight: 12 },
    { regex: /\bif\s+.*\s*:\s*\n\s+/g, weight: 15 },
    { regex: /\belif\s+.*\s*:/g, weight: 15 },
    { regex: /\btry\s*:\s*\n\s+/g, weight: 15 },
    { regex: /\bprint\(.*\)/g, weight: 8 },
    { regex: /\b__init__\b/g, weight: 15 },
    { regex: /@\w+/g, weight: 10 },
  ],
  java: [
    { regex: /\bpublic\s+class\s+\w+/g, weight: 20 },
    { regex: /\bpublic\s+static\s+void\s+main\b/g, weight: 25 },
    { regex: /\bSystem\.out\.print(ln)?\(/g, weight: 15 },
    { regex: /\bString\[\]\s+args\b/g, weight: 15 },
    { regex: /@Override\b/g, weight: 12 },
    { regex: /\bextends\s+\w+|\bimplements\s+\w+/g, weight: 12 },
  ],
  cpp: [
    { regex: /#include\s+<.*>/g, weight: 20 },
    { regex: /\busing\s+namespace\s+std\b/g, weight: 20 },
    { regex: /\bcout\s*<</g, weight: 15 },
    { regex: /\bint\s+main\s*\(.*\)/g, weight: 15 },
    { regex: /\bstd::\w+/g, weight: 12 },
  ],
  csharp: [
    { regex: /\busing\s+System(\.\w+)*;/g, weight: 20 },
    { regex: /\bnamespace\s+\w+(\.\w+)*\s*\{/g, weight: 15 },
    { regex: /\bpublic\s+partial\s+class\b/g, weight: 15 },
    { regex: /\bConsole\.Write(Line)?\(/g, weight: 15 },
  ],
  html: [
    { regex: /<!DOCTYPE\s+html>/gi, weight: 25 },
    { regex: /<html.*>/gi, weight: 20 },
    { regex: /<div.*>/gi, weight: 10 },
    { regex: /<script.*>/gi, weight: 15 },
    { regex: /<style.*>/gi, weight: 15 },
    { regex: /<\/?[a-z][a-z0-9]*[^<>]*>/gi, weight: 5 },
  ],
  css: [
    { regex: /[.#]\w+\s*\{/g, weight: 15 },
    { regex: /\b(margin|padding|color|background|display|flex|grid):/g, weight: 10 },
    { regex: /@media\s+.*\s*\{/g, weight: 15 },
    { regex: /!important/g, weight: 10 },
  ],
  sql: [
    { regex: /\bSELECT\b.*\bFROM\b/gi, weight: 20 },
    { regex: /\bINSERT\s+INTO\b/gi, weight: 20 },
    { regex: /\bUPDATE\b.*\bSET\b/gi, weight: 20 },
    { regex: /\bDELETE\s+FROM\b/gi, weight: 20 },
    { regex: /\bCREATE\s+TABLE\b/gi, weight: 20 },
    { regex: /\bGROUP\s+BY\b/gi, weight: 15 },
  ],
  json: [
    { regex: /^\s*[{[]/g, weight: 10 },
    { regex: /"\w+"\s*:/g, weight: 15 },
    { regex: /:\s*["\d[{]/g, weight: 10 },
  ],
  bash: [
    { regex: /^#!\/(bin|usr)\/(env\s+)?(bash|sh|zsh)/m, weight: 30 },
    { regex: /\becho\s+["'].*["']/g, weight: 10 },
    { regex: /\bif\s+\[\s+.*\s+\]\s*;?\s*then/g, weight: 20 },
    { regex: /\b(grep|awk|sed|curl|wget|chmod|chown)\b/g, weight: 10 },
  ],
  yaml: [
    { regex: /^---\s*$/m, weight: 15 },
    { regex: /^\w+:\s+.*$/m, weight: 10 },
    { regex: /^\s*-\s+.*$/m, weight: 10 },
  ]
};

const EXPLICIT_MARKERS = {
  markdown_code: /```(\w+)?\n([\s\S]*?)```/g,
  inline_code: /`([^`\n]+)`/g,
  indented_block: /^(\s{4,}|\t+)([^\s].*)$/gm,
  shebang: /^#!\/(bin|usr)\/(env\s+)?(\w+)/m,
};

const FAST_CHECK_REGEX = /[;{}()[\]=<>!]|\b(const|let|var|def|func|public|private|static|import|if|else|return|class)\b/;

// Basic LRU-like cache for line detections to avoid redundant regex runs
const DETECTION_CACHE = new Map<string, CodeDetectionResult>();
const MAX_CACHE_SIZE = 500;

/**
 * Detects if a string is code and identifies its language.
 * Optimized for performance with early exits and fast-path filtering.
 */
export function detectCode(text: string): CodeDetectionResult {
  // 1. Fast Path: Length and basic character check
  if (text.length < 3) return { isCode: false, language: 'plaintext', confidence: 0, formattedText: text };
  
  // 2. Cache check for performance on repeated lines
  const cached = DETECTION_CACHE.get(text);
  if (cached) return cached;

  if (text.length < 100 && !FAST_CHECK_REGEX.test(text)) {
    return { isCode: false, language: 'plaintext', confidence: 0, formattedText: text };
  }

  // 3. Check for triple-backtick Markdown blocks (Highest Confidence)
  if (text.startsWith('```')) {
    const markdownMatch = text.match(/^```(\w+)?\n/);
    if (markdownMatch) {
      const result = {
        isCode: true,
        language: (markdownMatch[1] || 'plaintext').toLowerCase(),
        confidence: 1.0,
        formattedText: text
      };
      cacheResult(text, result);
      return result;
    }
  }

  // 4. Check for shebang
  if (text.startsWith('#!/')) {
    const shebangMatch = text.match(EXPLICIT_MARKERS.shebang);
    if (shebangMatch) {
      const lang = shebangMatch[3].toLowerCase();
      const result = {
        isCode: true,
        language: lang === 'sh' ? 'bash' : lang,
        confidence: 1.0,
        formattedText: text
      };
      cacheResult(text, result);
      return result;
    }
  }

  let bestLang = 'plaintext';
  let maxScore = 0;

  // 5. Score languages based on patterns
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern.regex);
      if (matches) {
        score += matches.length * pattern.weight;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestLang = lang;
    }
    
    // Early exit for very high score
    if (score > 100) break;
  }

  // 6. Structural analysis (Optimized: only if pattern score is low)
  let codeRatio = 0;
  if (maxScore < 20) {
    const lines = text.split('\n');
    const totalLines = lines.filter(l => l.trim().length > 0).length;
    
    if (totalLines > 0) {
      let codeLikeLines = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        if (/[;{}:]$/.test(trimmed)) { codeLikeLines++; continue; }
        if (/^(\/\/|#|\/\*|--)/.test(trimmed)) { codeLikeLines++; continue; }
        if (/^(const|let|var|def|class|public|private|static|import|from|using|namespace)\b/.test(trimmed)) { codeLikeLines++; continue; }
        if (/^<.*>$/.test(trimmed)) { codeLikeLines++; continue; }
      }
      codeRatio = codeLikeLines / totalLines;
    }
  } else {
    codeRatio = 0.5; // Assume moderate structural confidence if pattern score is high
  }
  
  // Final decision
  const confidence = Math.min((maxScore / 40) + (codeRatio * 0.6), 1.0);
  const isCode = confidence > 0.45 || (codeRatio > 0.7 && text.length > 20);

  const result = {
    isCode,
    language: isCode ? bestLang : 'plaintext',
    confidence,
    formattedText: text
  };

  cacheResult(text, result);
  return result;
}

function cacheResult(text: string, result: CodeDetectionResult) {
  if (DETECTION_CACHE.size >= MAX_CACHE_SIZE) {
    // Simple eviction: clear entire cache if it gets too big
    // (Better than full LRU for this simple use case)
    DETECTION_CACHE.clear();
  }
  DETECTION_CACHE.set(text, result);
}

/**
 * Automatically detects and wraps code blocks in a larger text.
 * Improved version that handles mixed natural language and code.
 */
export function autoFormatText(text: string): string {
  if (!text || text.includes('```')) return text;

  const lines = text.split('\n');
  const detections = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return { type: 'empty', score: 0, lang: 'plaintext' };
    
    // Check for conversation markers to de-weight them
    if (/^(User|Assistant|System|Bot|Me):\s+/i.test(trimmed)) {
      return { type: 'text', score: -5, lang: 'plaintext' };
    }

    const det = detectCode(line);
    return { 
      type: det.isCode ? 'code' : 'text', 
      score: det.confidence * (det.isCode ? 10 : -5),
      lang: det.language 
    };
  });

  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    
    // Look ahead to see if a code block starts here
    // A code block starts if we see a cluster of high-score lines
    let lookAhead = 0;
    let clusterScore = 0;
    const potentialBlock: string[] = [];
    const detectedLangs: Record<string, number> = {};

    while (i + lookAhead < lines.length) {
      const det = detections[i + lookAhead];
      if (det.type === 'empty' && potentialBlock.length > 0) {
        // Allow some empty lines within a block
        clusterScore += 1; 
      } else {
        clusterScore += det.score;
      }

      potentialBlock.push(lines[i + lookAhead]);
      if (det.lang !== 'plaintext') {
        detectedLangs[det.lang] = (detectedLangs[det.lang] || 0) + 1;
      }

      // If score drops significantly, stop looking ahead
      if (clusterScore < -10 && lookAhead > 2) break;
      
      lookAhead++;
    }

    // Determine if we found a "solid" block of code
    // Threshold: at least 2 lines and a positive cluster score
    if (potentialBlock.length >= 2 && clusterScore > 15) {
      // Find the most frequent language
      let dominantLang = 'plaintext';
      let maxFreq = 0;
      for (const [l, f] of Object.entries(detectedLangs)) {
        if (f > maxFreq) {
          maxFreq = f;
          dominantLang = l;
        }
      }

      // Cleanup the block: remove leading/trailing text/empty lines
      while (potentialBlock.length > 0 && detections[i].score <= 0) {
        result.push(potentialBlock.shift()!);
        i++;
      }
      
      const blockLines: string[] = [];
      while (potentialBlock.length > 0) {
        const nextDet = detections[i + blockLines.length];
        // If we hit a very low score line, stop the block
        if (nextDet && nextDet.score < -8 && blockLines.length > 2) break;
        blockLines.push(potentialBlock.shift()!);
      }

      if (blockLines.length > 0) {
        result.push(`\`\`\`${dominantLang}\n${blockLines.join('\n')}\n\`\`\``);
        i += blockLines.length;
      }
    } else {
      // Not a code block, just add the line
      result.push(line);
      i++;
    }
  }

  // Second pass: Detect inline code in remaining text lines
  return result.map(line => {
    if (line.startsWith('```')) return line;
    
    // Simple inline detection: look for things like const x = 5 or func() inside a sentence
    // But only if it's not already in backticks
    return line.replace(/(?<!`)\b(const|let|var|def|function)\s+\w+\s*=[^,.;!]+(?![^`]*`)/g, '`$&`');
  }).join('\n');
}

