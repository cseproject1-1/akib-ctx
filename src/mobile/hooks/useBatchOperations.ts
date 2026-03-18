import { useCallback } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { useReactFlow, useNodes } from '@xyflow/react';

export function useBatchOperations() {
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useNodes();
  const { setNodes } = useReactFlow();

  const deleteNodes = useCallback((nodeIds: string[]) => {
    nodeIds.forEach(id => deleteNode(id));
    // Silent mode - visual feedback shows deletion
  }, [deleteNode]);

  const duplicateNodes = useCallback((nodeIds: string[]) => {
    const duplicated: string[] = [];
    nodeIds.forEach(id => {
      const node = nodes.find(n => n.id === id);
      if (node) {
        duplicateNode(id);
        duplicated.push(id);
      }
    });
    // Silent mode - visual feedback shows duplication
  }, [duplicateNode, nodes]);

  const moveNodes = useCallback((nodeIds: string[], deltaX: number, deltaY: number) => {
    setNodes((nds) =>
      nds.map((n) =>
        nodeIds.includes(n.id)
          ? { ...n, position: { x: n.position.x + deltaX, y: n.position.y + deltaY } }
          : n
      )
    );
    // Silent mode - visual feedback shows movement
  }, [setNodes]);

  const groupNodes = useCallback((nodeIds: string[]) => {
    const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
    if (selectedNodes.length === 0) return;

    const minX = Math.min(...selectedNodes.map(n => n.position.x));
    const minY = Math.min(...selectedNodes.map(n => n.position.y));
    const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.style?.width as number || 200)));
    const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.style?.height as number || 100)));

    const groupNode = {
      id: crypto.randomUUID(),
      type: 'group',
      position: { x: minX - 20, y: minY - 20 },
      style: {
        width: maxX - minX + 40,
        height: maxY - minY + 40,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 8,
        border: '2px dashed rgba(59, 130, 246, 0.3)',
      },
      data: { label: 'Group' },
    };

    addNode(groupNode);
    // Silent mode - visual feedback shows group created
  }, [nodes, addNode]);

  const alignNodes = useCallback((nodeIds: string[], direction: 'left' | 'right' | 'top' | 'bottom' | 'center') => {
    const selectedNodes = nodes.filter(n => nodeIds.includes(n.id));
    if (selectedNodes.length === 0) return;

    const positions = selectedNodes.map(n => n.position);
    
    switch (direction) {
      case 'left': {
        const minX = Math.min(...positions.map(p => p.x));
        setNodes((nds) =>
          nds.map((n) =>
            nodeIds.includes(n.id)
              ? { ...n, position: { x: minX, y: n.position.y } }
              : n
          )
        );
        break;
      }
      case 'right': {
        const maxX = Math.max(...positions.map(p => p.x));
        setNodes((nds) =>
          nds.map((n) =>
            nodeIds.includes(n.id)
              ? { ...n, position: { x: maxX, y: n.position.y } }
              : n
          )
        );
        break;
      }
      case 'top': {
        const minY = Math.min(...positions.map(p => p.y));
        setNodes((nds) =>
          nds.map((n) =>
            nodeIds.includes(n.id)
              ? { ...n, position: { x: n.position.x, y: minY } }
              : n
          )
        );
        break;
      }
      case 'bottom': {
        const maxY = Math.max(...positions.map(p => p.y));
        setNodes((nds) =>
          nds.map((n) =>
            nodeIds.includes(n.id)
              ? { ...n, position: { x: n.position.x, y: maxY } }
              : n
          )
        );
        break;
      }
      case 'center': {
        const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
        const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
        setNodes((nds) =>
          nds.map((n) =>
            nodeIds.includes(n.id)
              ? { ...n, position: { x: avgX, y: avgY } }
              : n
          )
        );
        break;
      }
    }
    // Silent mode - visual feedback shows alignment
  }, [nodes, setNodes]);

  return {
    deleteNodes,
    duplicateNodes,
    moveNodes,
    groupNodes,
    alignNodes,
  };
}

export default useBatchOperations;
