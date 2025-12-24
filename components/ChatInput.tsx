
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative group max-w-4xl mx-auto w-full px-4 mb-6">
      <div className="relative flex items-end w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl focus-within:border-blue-500 transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent text-slate-100 py-4 pl-5 pr-14 resize-none outline-none max-h-60 min-h-[56px] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled}
          className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-all duration-200 flex items-center justify-center"
        >
          {disabled ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
      <p className="text-center text-[10px] text-slate-500 mt-2">
        Gemini Assistant can make mistakes. Consider checking important information.
      </p>
    </form>
  );
};

export default ChatInput;
