
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Role, SearchSource } from './types';
import { geminiService } from './services/geminiService';
import ChatInput from './components/ChatInput';
import MarkdownRenderer from './components/MarkdownRenderer';
import { Bot, User, Cpu, Sparkles, Trash2, Globe, Brain, ExternalLink, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Formatting date correctly as requested
  const formatMsgDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const handleSend = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { text, sources } = await geminiService.sendMessage([...messages, userMessage], {
        useSearch,
        useDeepThinking: useThinking
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.ASSISTANT,
        content: text,
        timestamp: Date.now(),
        sources: sources
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.ASSISTANT,
        content: "Συγγνώμη, συνέβη ένα σφάλμα. Παρακαλώ δοκιμάστε ξανά.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, useSearch, useThinking]);

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-100 overflow-hidden">
      {/* Header with 'Bill' branding */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-white/5 backdrop-blur-xl z-10 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Bill AI</h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Pro v3</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ενεργός & Έτοιμος</span>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="flex items-center gap-3 bg-slate-800/50 p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setUseSearch(!useSearch)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-xs font-semibold ${useSearch ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Web Search</span>
          </button>
          <button 
            onClick={() => setUseThinking(!useThinking)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-xs font-semibold ${useThinking ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Deep Think</span>
          </button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <button 
            onClick={() => setMessages([])}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Message List */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 space-y-10 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-700">
            <div className="relative group">
              <div className="absolute -inset-8 bg-blue-600/20 blur-3xl rounded-full group-hover:bg-blue-600/30 transition-all duration-500"></div>
              <div className="w-24 h-24 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center relative shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent"></div>
                <Sparkles className="w-12 h-12 text-blue-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-white tracking-tight">Γεια, είμαι ο <span className="text-blue-500">Bill</span>.</h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                Ο προσωπικός σου βοηθός επόμενης γενιάς. Πώς μπορώ να σε βοηθήσω σήμερα;
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { label: "Νέα από το Google", icon: <Globe className="w-4 h-4" />, action: () => { setUseSearch(true); handleSend("Ποια είναι τα σημαντικότερα σημερινά νέα στην Ελλάδα;"); } },
                { label: "Πολύπλοκη Λύση", icon: <Brain className="w-4 h-4" />, action