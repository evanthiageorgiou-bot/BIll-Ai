
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, Role, SearchSource } from './types';
import { geminiService } from './services/geminiService';
import ChatInput from './components/ChatInput';
import MarkdownRenderer from './components/MarkdownRenderer';
import { Bot, User, Cpu, Sparkles, Trash2, Globe, Brain, ExternalLink, ShieldCheck, Image as ImageIcon, Volume2, Mic, MicOff, Loader2, X, Play, Film, History, Key } from 'lucide-react';

// Define the AIStudio interface to match the environment
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

declare global {
  interface Window {
    // Removed readonly to fix "All declarations of 'aistudio' must have identical modifiers" error
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('bill_chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [useImageGen, setUseImageGen] = useState(false);
  const [useVideoGen, setUseVideoGen] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [liveTranscription, setLiveTranscription] = useState<{user: string, bill: string}>({user: '', bill: ''});
  const [showKeyHint, setShowKeyHint] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    localStorage.setItem('bill_chat_history', JSON.stringify(messages));
  }, [messages]);

  const formatMsgDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('el-GR', {
      day: '2-digit',
      month: 'short',
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
  }, [messages, isLoading, liveTranscription]);

  // Decode PCM audio data manually as required by Live API guidelines
  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const checkApiKey = async () => {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
      // Proceed assuming success as per guidelines to avoid race condition
      return true;
    }
    return true;
  };

  const handleSend = useCallback(async (content: string, attachment?: string) => {
    // Advanced features (Video / Deep Thinking) require a selected API key
    if (useVideoGen || useThinking) {
      await checkApiKey();
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content,
      timestamp: Date.now(),
      imageUrl: attachment
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setLoadingStep(useVideoGen ? 'Ο Bill σκηνοθετεί...' : 'Ο Bill επεξεργάζεται το αίτημα...');

    try {
      const { text, sources, imageUrl, videoUrl } = await geminiService.sendMessage([...messages, userMessage], {
        useSearch,
        useDeepThinking: useThinking,
        useImageGen,
        useVideoGen,
        attachment
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.ASSISTANT,
        content: text,
        timestamp: Date.now(),
        sources: sources,
        imageUrl: imageUrl,
        videoUrl: videoUrl
      };
      setMessages(prev => [...prev, assistantMessage]);
      setShowKeyHint(false);
    } catch (error: any) {
      const errMsg = error.message || "";
      let userFriendlyError = "Συγγνώμη, συνέβη ένα σφάλμα.";

      if (errMsg.includes("Permission denied") || errMsg.includes("Requested entity was not found")) {
        userFriendlyError = "Δεν έχετε δικαίωμα χρήσης αυτού του μοντέλου. Παρακαλώ επιλέξτε ένα έγκυρο API Key από ένα project με χρέωση (Paid Project).";
        setShowKeyHint(true);
        // Prompt for key again automatically if it's a permission issue
        await window.aistudio.openSelectKey();
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: Role.ASSISTANT,
        content: userFriendlyError,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      setUseImageGen(false);
      setUseVideoGen(false);
      setLoadingStep('');
    }
  }, [messages, useSearch, useThinking, useImageGen, useVideoGen]);

  const speakText = async (id: string, text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(id);
    try {
      const base64Audio = await geminiService.textToSpeech(text);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      // Manual decode base64 as per guidelines
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(null);
      source.start();
    } catch (e) {
      setIsSpeaking(null);
    }
  };

  const startLiveMode = async () => {
    setIsLiveMode(true);
    setLiveTranscription({user: '', bill: ''});
    
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = geminiService.connectLive({
        onAudioData: async (base64) => {
          const ctx = audioContextRef.current!;
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
          // Manual decode base64 as per guidelines
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.onended = () => sourcesRef.current.delete(source);
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          sourcesRef.current.add(source);
        },
        onInterrupted: () => {
          for (const source of sourcesRef.current) source.stop();
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        },
        onTranscription: (text, isUser) => {
          setLiveTranscription(prev => ({
            user: isUser ? prev.user + text : prev.user,
            bill: !isUser ? prev.bill + text : prev.bill
          }));
        },
        onTurnComplete: () => {
          setLiveTranscription({user: '', bill: ''});
        },
        onClose: () => stopLiveMode()
      });

      liveSessionRef.current = await sessionPromise;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
        const bytes = new Uint8Array(int16.buffer);
        // Manual encode to base64 as per guidelines
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        // Use then() to avoid stale closures and ensure connection is ready
        sessionPromise.then(session => {
          session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
        });
      };
      source.connect(processor);
      processor.connect(inputCtx.destination);
      
      (liveSessionRef.current as any)._audioCleanup = () => {
        stream.getTracks().forEach(t => t.stop());
        processor.disconnect();
        source.disconnect();
        inputCtx.close();
      };
    } catch (err: any) {
      console.error(err);
      setIsLiveMode(false);
      alert("Permission denied: Δεν ήταν δυνατή η πρόσβαση στο μικρόφωνο.");
    }
  };

  const stopLiveMode = () => {
    if (liveSessionRef.current) {
      if (liveSessionRef.current._audioCleanup) liveSessionRef.current._audioCleanup();
      liveSessionRef.current.close();
    }
    if (audioContextRef.current) audioContextRef.current.close();
    setIsLiveMode(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-100 overflow-hidden font-['Inter']">
      <header className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-900/95 border-b border-white/5 backdrop-blur-2xl z-20 shadow-2xl gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Bill AI</h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Ultimate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Live & Cinema Mode</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 bg-slate-800/50 p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => window.aistudio.openSelectKey()}
            className={`p-2 rounded-xl transition-all ${showKeyHint ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse' : 'text-slate-400 hover:bg-slate-700'}`}
            title="Manage API Key"
          >
            <Key className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <button 
            onClick={isLiveMode ? stopLiveMode : startLiveMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-xs font-bold ${isLiveMode ? 'bg-red-600 text-white shadow-lg animate-pulse' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg'}`}
          >
            {isLiveMode ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isLiveMode ? 'Stop Voice' : 'Voice Chat'}</span>
          </button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <button 
            onClick={() => setUseVideoGen(!useVideoGen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-xs font-semibold ${useVideoGen ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <Film className="w-4 h-4" />
            <span className="hidden lg:inline">Cinema Mode</span>
          </button>
          <button 
            onClick={() => setUseSearch(!useSearch)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-xs font-semibold ${useSearch ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden lg:inline">Search</span>
          </button>
          <button 
            onClick={() => setUseThinking(!useThinking)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-xs font-semibold ${useThinking ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <Brain className="w-4 h-4" />
            <span className="hidden lg:inline">Deep Think</span>
          </button>
          <button 
            onClick={() => setUseImageGen(!useImageGen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 text-xs font-semibold ${useImageGen ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden lg:inline">Draw</span>
          </button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <button onClick={() => setMessages([])} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 space-y-10 scroll-smooth relative">
        {showKeyHint && (
          <div className="max-w-xl mx-auto mb-8 animate-in slide-in-from-top duration-500">
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-4 items-start shadow-xl">
              <Key className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <h4 className="font-bold text-amber-400">Απαιτείται API Key με Χρέωση</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Για τη χρήση των μοντέλων <b>Cinema Mode (Veo)</b> και <b>Deep Thinking</b>, πρέπει να επιλέξετε ένα API Key από το δικό σας Paid Project στο Google Cloud.
                </p>
                <button 
                  onClick={() => window.aistudio.openSelectKey()}
                  className="px-4 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg hover:bg-amber-400 transition-colors"
                >
                  Επιλογή API Key
                </button>
              </div>
              <button onClick={() => setShowKeyHint(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {isLiveMode && (
          <div className="fixed inset-0 z-50 bg-[#020617]/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
            <button onClick={stopLiveMode} className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all">
              <X className="w-8 h-8" />
            </button>
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-blue-600/30 blur-[100px] rounded-full animate-pulse"></div>
              <div className="w-48 h-48 rounded-full border-2 border-blue-500/50 flex items-center justify-center relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 shadow-2xl flex items-center justify-center animate-bounce duration-[2000ms]">
                   <Mic className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Ο Bill σε ακούει...</h2>
            <div className="max-w-2xl w-full text-center space-y-6">
              <div className="min-h-[60px] p-6 bg-slate-900/50 rounded-3xl border border-white/5 text-blue-400 font-medium italic">
                {liveTranscription.user || "Πες κάτι..."}
              </div>
              <div className="min-h-[100px] p-6 bg-blue-600/10 rounded-3xl border border-blue-500/20 text-white text-xl leading-relaxed">
                {liveTranscription.bill || "Ο Bill προετοιμάζεται..."}
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 && !isLiveMode && (
          <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-700">
            <div className="relative group">
              <div className="absolute -inset-8 bg-blue-600/20 blur-3xl rounded-full"></div>
              <div className="w-24 h-24 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center relative shadow-2xl">
                <Sparkles className="w-12 h-12 text-blue-400" />
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-white tracking-tight">Γεια, είμαι ο <span className="text-blue-500">Bill</span>.</h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                Ο απόλυτος AI βοηθός σου. Τώρα μπορώ να <b>δώ</b> τις εικόνες σου, να δημιουργήσω <b>κινηματογραφικά βίντεο</b> και να μιλήσουμε <b>ζωντανά</b>.
              </p>
            </div>
            <div className="flex gap-3">
               <div className="px-4 py-2 bg-slate-800/50 rounded-full border border-white/5 text-xs text-slate-400 flex items-center gap-2">
                 <History className="w-3 h-3" /> Το ιστορικό αποθηκεύεται τοπικά
               </div>
            </div>
          </div>
        )}

        {!isLiveMode && messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex w-full ${message.role === Role.USER ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
          >
            <div className={`flex max-w-[90%] sm:max-w-[80%] gap-4 ${message.role === Role.USER ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                message.role === Role.USER 
                  ? 'bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-white/10' 
                  : 'bg-gradient-to-br from-blue-600 to-indigo-700 ring-1 ring-white/20'
              }`}>
                {message.role === Role.USER ? <User className="w-5 h-5 text-slate-300" /> : <Bot className="w-5 h-5 text-white" />}
              </div>
              
              <div className={`flex flex-col gap-2 ${message.role === Role.USER ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-4 rounded-3xl shadow-xl relative group overflow-hidden ${
                  message.role === Role.USER 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-[#1e293b] text-slate-100 rounded-tl-none border border-white/5'
                }`}>
                  {message.imageUrl && (
                    <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                      <img src={message.imageUrl} alt="AI Attachment" className="w-full max-h-[400px] object-contain bg-slate-950" />
                    </div>
                  )}
                  {message.videoUrl && (
                    <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black aspect-video">
                      <video src={message.videoUrl} controls className="w-full h-full" />
                    </div>
                  )}
                  <MarkdownRenderer content={message.content || '...'} />
                  
                  {/* Extract and display search grounding sources as required by guidelines */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Globe className="w-3 h-3" /> Πηγές Αναζήτησης
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {message.sources.map((source, idx) => (
                          <a 
                            key={idx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-blue-400 flex items-center gap-1 transition-colors"
                          >
                            {source.title} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.role === Role.ASSISTANT && (
                    <button 
                      onClick={() => speakText(message.id, message.content)}
                      disabled={isSpeaking !== null}
                      className={`absolute -right-12 top-0 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-opacity ${isSpeaking === message.id ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover:opacity-100'}`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-medium tracking-tight">
                  {formatMsgDate(message.timestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && !isLiveMode && (
          <div className="flex justify-start animate-pulse">
            <div className="flex gap-4 items-start max-w-[80%]">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center"><Bot className="w-5 h-5 text-slate-500" /></div>
              <div className="bg-slate-800/50 px-8 py-6 rounded-3xl rounded-tl-none border border-white/5 flex flex-col items-center gap-4 text-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <div className="space-y-1">
                  <span className="text-sm text-slate-200 font-bold block">{loadingStep}</span>
                  <span className="text-[10px] text-slate-400">Παρακαλώ περίμενε...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {!isLiveMode && (
        <footer className="bg-gradient-to-t from-[#020617] via-[#020617] to-transparent pt-6 pb-2">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </footer>
      )}
    </div>
  );
};

export default App;
