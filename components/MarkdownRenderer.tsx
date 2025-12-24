
import React from 'react';

// Basic markdown renderer for simplicity without external heavy deps if needed, 
// but we will use a refined simple parser for core elements.
interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple regex-based parsing for basic formatting if full libs aren't loaded
  // In a real production app, use react-markdown. 
  // For this expert delivery, we'll format blocks cleanly.
  
  const formatText = (text: string) => {
    // Escape HTML
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-900 p-4 rounded-lg my-3 overflow-x-auto border border-slate-700 font-mono text-sm text-blue-300"><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-1.5 py-0.5 rounded font-mono text-pink-400">$1</code>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    
    // Lists
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br />');

    return html;
  };

  return (
    <div 
      className="prose prose-invert max-w-none text-slate-200"
      dangerouslySetInnerHTML={{ __html: formatText(content) }}
    />
  );
};

export default MarkdownRenderer;
