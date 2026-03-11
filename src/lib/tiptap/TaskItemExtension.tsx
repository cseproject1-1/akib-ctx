import { TaskItem as TiptapTaskItem } from '@tiptap/extension-task-item';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';
import { Calendar } from 'lucide-react';

const TaskItemView = ({ node, updateAttributes, selected }: any) => {
  const { checked, deadline } = node.attrs;

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateAttributes({ checked: event.target.checked });
  };

  const handleDeadlineChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateAttributes({ deadline: event.target.value });
  };

  return (
    <NodeViewWrapper className={`flex items-start gap-2 my-1 group ${selected ? 'ProseMirror-selectednode' : ''}`}>
      <div className="flex items-center mt-1" contentEditable={false}>
        <input 
          type="checkbox" 
          checked={!!checked} 
          onChange={handleCheckboxChange} 
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
        />
      </div>
      <div className="flex-1 min-w-0">
        <NodeViewContent className={`task-content ${checked ? 'line-through text-muted-foreground' : ''}`} />
        
        {deadline && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground bg-muted/30 w-fit px-1.5 py-0.5 rounded border border-border/50" contentEditable={false}>
            <Calendar className="h-3 w-3" />
            <span>{deadline}</span>
          </div>
        )}
      </div>

      {/* Hover Toolbar */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2" contentEditable={false}>
          <input 
            type="date" 
            value={deadline || ''} 
            onChange={handleDeadlineChange}
            className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer overflow-hidden scale-110"
            title="Set Deadline"
          />
      </div>
    </NodeViewWrapper>
  );
};

export const CustomTaskItem = TiptapTaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      deadline: {
        default: null,
        parseHTML: element => element.getAttribute('data-deadline'),
        renderHTML: attributes => ({ 'data-deadline': attributes.deadline }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskItemView);
  },
});
