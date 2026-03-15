import { loadCanvasNodes } from './firebase/canvasData';
import { getWorkspaces, type Workspace } from './firebase/workspaces';
import Fuse from 'fuse.js';
import type { Node } from '@xyflow/react';

export interface GlobalSearchResult {
  node: Node;
  workspace: Workspace;
}

class GlobalSearchService {
  private index: GlobalSearchResult[] = [];
  private fuse: Fuse<GlobalSearchResult> | null = null;
  private isIndexing = false;

  async startIndexing() {
    if (this.isIndexing) return;
    this.isIndexing = true;
    
    try {
      const workspaces = await getWorkspaces();
      const allResults: GlobalSearchResult[] = [];

      // Fetch nodes for each workspace
      // Using Promise.all with some concurrency limit if needed, but for now simple
      const nodePromises = workspaces.map(async (ws) => {
        try {
          const nodes = await loadCanvasNodes(ws.id);
          return nodes.map(node => ({ node, workspace: ws }));
        } catch (err) {
          console.warn(`Failed to index nodes for workspace ${ws.id}`, err);
          return [];
        }
      });

      const resultsArray = await Promise.all(nodePromises);
      resultsArray.forEach(res => allResults.push(...res));

      this.index = allResults;
      this.fuse = new Fuse(this.index, {
        keys: [
          'node.data.title',
          'node.data.text',
          'node.data.label',
          'workspace.name'
        ],
        threshold: 0.4,
        ignoreLocation: true
      });
    } finally {
      this.isIndexing = false;
    }
  }

  search(query: string): GlobalSearchResult[] {
    if (!this.fuse || !query) return [];
    return this.fuse.search(query).map(r => r.item).slice(0, 15);
  }

  clear() {
    this.index = [];
    this.fuse = null;
  }
}

export const globalSearch = new GlobalSearchService();
