import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';
import { Info, AlertTriangle, AlertCircle, CheckCircle, ChevronRight, HelpCircle } from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
  question: HelpCircle,
};

const CalloutView = ({ node, updateAttributes, selected }: any) => {
  const { type, color, icon, isCollapsed } = node.attrs;
  const IconComponent = ICON_MAP[icon || type] || Info;

  const toggleCollapse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateAttributes({ isCollapsed: !isCollapsed });
  };

  const setType = (newType: string) => {
    updateAttributes({ type: newType, icon: newType });
  };

  return (
    <NodeViewWrapper 
      className={`callout-block my-4 rounded-lg border p-4 transition-all duration-300 relative ${selected ? 'ring-2 ring-primary' : ''}`}
      style={{ 
        backgroundColor: color || 'transparent',
        borderColor: color ? `${color}44` : 'inherit'
      }}
      data-callout-type={type}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-2 items-center" contentEditable={false}>
          <div className="p-1 rounded-md bg-background/50 cursor-pointer hover:scale-110 transition-transform">
             <IconComponent className="h-5 w-5" style={{ color: color || 'currentColor' }} />
          </div>
          <button 
            onClick={toggleCollapse}
            className="p-1 rounded hover:bg-muted/50 transition-colors"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className={`transition-all duration-300 overflow-hidden ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}`}>
            <NodeViewContent className="callout-content" />
          </div>
          {isCollapsed && (
            <div className="text-sm text-muted-foreground italic cursor-pointer select-none" onClick={toggleCollapse}>
              Content collapsed...
            </div>
          )}
        </div>
      </div>

      {/* Mini Color/Type Toolbar when selected */}
      {selected && (
        <div className="absolute -top-10 left-0 bg-background border rounded-md shadow-lg p-1 flex items-center gap-1 z-50 animate-in fade-in slide-in-from-bottom-2" contentEditable={false}>
          {Object.keys(ICON_MAP).map(t => (
            <button 
              key={t}
              onClick={() => setType(t)}
              className={`p-1.5 rounded-md hover:bg-muted ${type === t ? 'bg-muted' : ''}`}
              title={t.charAt(0).toUpperCase() + t.slice(1)}
            >
              {React.createElement(ICON_MAP[t], { className: 'h-4 w-4' })}
            </button>
          ))}
          <div className="w-[1px] h-4 bg-border mx-1" />
          <input 
            type="color" 
            value={color || '#000000'} 
            onChange={(e) => updateAttributes({ color: e.target.value })}
            className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer rounded overflow-hidden"
          />
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  selectable: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-callout-type') || 'info',
        renderHTML: attributes => ({ 'data-callout-type': attributes.type }),
      },
      color: {
        default: null,
        parseHTML: element => element.style.backgroundColor,
        renderHTML: attributes => {
          if (!attributes.color) return {};
          return { style: `background-color: ${attributes.color}` };
        },
      },
      icon: {
        default: null,
        parseHTML: element => element.getAttribute('data-icon'),
        renderHTML: attributes => ({ 'data-icon': attributes.icon }),
      },
      isCollapsed: {
        default: false,
        parseHTML: element => element.hasAttribute('data-collapsed'),
        renderHTML: attributes => (attributes.isCollapsed ? { 'data-collapsed': '' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout-block' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout: (attrs?: any) => ({ commands }) => {
        return commands.wrapIn(this.name, attrs);
      },
      updateCallout: (attrs: any) => ({ commands }) => {
        return commands.updateAttributes(this.name, attrs);
      },
    } as any;
  },
});
