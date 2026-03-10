import fs from 'fs/promises';
import path from 'path';

async function processDirectory(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      await processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      await refactorFile(fullPath);
    }
  }
}

async function refactorFile(filePath) {
  let content = await fs.readFile(filePath, 'utf-8');
  let changed = false;

  // Pattern: const { a, b: alias } = useCanvasStore();
  // Group 1: extracted vars
  const regex = /const\s+\{\s*([^}]+)\s*\}\s*=\s*useCanvasStore\(\)\s*;/g;

  content = content.replace(regex, (match, varsStr) => {
    changed = true;
    const parts = varsStr.split(',').map(s => s.trim()).filter(Boolean);
    
    // We want to handle useNodes and useEdges dynamically
    let needsUseNodes = false;
    let needsUseEdges = false;
    
    const statements = parts.map(part => {
      // Handle cases like "nodes: currentNodes"
      if (part.includes(':')) {
        const [key, alias] = part.split(':').map(s => s.trim());
        if (key === 'nodes') { needsUseNodes = true; return `const ${alias} = useNodes();`; }
        if (key === 'edges') { needsUseEdges = true; return `const ${alias} = useEdges();`; }
        return `const ${alias} = useCanvasStore((s) => s.${key});`;
      } else {
        if (part === 'nodes') { needsUseNodes = true; return `const ${part} = useNodes();`; }
        if (part === 'edges') { needsUseEdges = true; return `const ${part} = useEdges();`; }
        return `const ${part} = useCanvasStore((s) => s.${part});`;
      }
    });

    return statements.join('\n  ');
  });

  if (changed) {
    // If we used useNodes or useEdges, we might need to import them
    if (content.includes('useNodes()') && !content.includes('useNodes')) {
        content = content.replace(/import\s+\{[^}]*useCanvasStore[^}]*\}\s+from\s+['"]([^'"]+)['"]/g, match => {
            if (match.includes('useNodes')) return match;
            return match.replace('useCanvasStore', 'useCanvasStore, useNodes');
        });
    }
    if (content.includes('useEdges()') && !content.includes('useEdges')) {
        content = content.replace(/import\s+\{[^}]*useCanvasStore[^}]*\}\s+from\s+['"]([^'"]+)['"]/g, match => {
            if (match.includes('useEdges')) return match;
            return match.replace('useCanvasStore', 'useCanvasStore, useEdges');
        });
    }
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Updated: ${filePath}`);
  }
}

async function main() {
  await processDirectory(path.join(process.cwd(), 'src'));
}

main().catch(console.error);
