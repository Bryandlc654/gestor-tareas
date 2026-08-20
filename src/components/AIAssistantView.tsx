import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Mic, Square, Send, Volume2, Bot, User, Globe } from 'lucide-react';

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
}

export default function AIAssistantView({ token }: { token: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: '¡Hola! Soy el asistente de Next Boost Peru. Puedo consultar el estado de tus tareas, crear nuevas tareas y ayudarte a organizar tu trabajo. ¿En qué puedo ayudarte?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
    }
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg = text.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: userMsg, userId: 'current' }),
      });
      const data = await res.json();
      const reply = data.reply || 'Lo siento, no pude procesar eso.';
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
      speakText(reply);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error de conexión. Intenta de nuevo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-PE';
    utterance.rate = 1.1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  return (
    <div className="animate-fade-in h-full flex flex-col text-[#37352F] text-xs font-sans" id="assistant-container">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-[#EDEDEB] shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#37352F] to-[#5A5A57] flex items-center justify-center shadow-xs">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#37352F]">Asistente IA</h2>
          <p className="text-[10px] text-[#91918E]">Gestión de tareas por voz y texto</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] text-[#91918E] font-mono">Conectado</span>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0 scroll-smooth" id="assistant-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'assistant' ? 'bg-[#37352F]' : 'bg-[#EDEDEB]'}`}>
              {msg.role === 'assistant' ? (
                <Bot className="w-3.5 h-3.5 text-white" />
              ) : (
                <User className="w-3.5 h-3.5 text-[#5A5A57]" />
              )}
            </div>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-[#37352F] text-white' : 'bg-[#F7F7F5] border border-[#EDEDEB]'} rounded-lg px-3.5 py-2.5 leading-relaxed`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => isSpeaking ? stopSpeaking() : speakText(msg.text)}
                  className="mt-1.5 flex items-center gap-1 text-[9px] text-[#91918E] hover:text-[#37352F] transition-colors cursor-pointer"
                  title={isSpeaking ? 'Detener' : 'Leer en voz alta'}
                >
                  {isSpeaking ? <Square className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                  {isSpeaking ? 'Detener' : 'Escuchar'}
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[#37352F] flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg px-3.5 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#91918E] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[#91918E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[#91918E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-[#EDEDEB] pt-3 shrink-0">
        <div className="flex items-end gap-2 bg-[#F7F7F5] border border-[#EDEDEB] rounded-lg p-2 focus-within:border-[#37352F] transition-colors">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Escuchando...' : 'Escribe o usa el micrófono...'}
            rows={1}
            className="flex-1 bg-transparent text-xs text-[#37352F] placeholder-[#91918E] outline-none resize-none max-h-20 py-1 px-1"
            disabled={isLoading}
          />
          <div className="flex items-center gap-1">
            {voiceSupported && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`p-1.5 rounded transition-all cursor-pointer ${isRecording ? 'bg-red-500 text-white shadow-xs animate-pulse' : 'text-[#5A5A57] hover:bg-[#EDEDEB] hover:text-[#37352F]'}`}
                title={isRecording ? 'Detener grabación' : 'Activar micrófono'}
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isLoading}
              className="p-1.5 bg-[#37352F] text-white rounded hover:bg-opacity-90 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[9px] text-[#91918E] mt-1.5 text-center">
          El asistente puede consultar y crear tareas en el Kanban
        </p>
      </div>
    </div>
  );
}
