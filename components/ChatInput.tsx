
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Paperclip, X, Image as ImageIcon } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string, attachment?: string) => void;
  disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((input.trim() || attachment) && !disabled) {
      onSend(input.trim() || "Ανάλυσε αυτή την εικόνα", attachment || undefined);
      setInput('');
      setAttachment(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 mb-6">
      {attachment && (
        <div className="mb-2 relative inline-block animate-in fade-in slide-in-from-bottom-2">
          <img src={attachment} alt="Attachment" className="w-20 h-20 object-cover rounded-xl border-2 border-blue-500 shadow-lg" />
          <button 
            onClick={() => setAttachment(null)}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex items-end w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl focus-within:border-blue-500 transition-all duration-200">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-4 text-slate-400 hover:text-blue-400 transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Στείλε ένα μήνυμα ή ανέβασε μια εικόνα..."
            rows={1}
            disabled={disabled}
            className="w-full bg-transparent text-slate-100 py-4 pr-14 resize-none outline-none max-h-60 min-h-[56px] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={(!input.trim() && !attachment) || disabled}
            className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-all duration-200 flex items-center justify-center"
          >
            {disabled ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
