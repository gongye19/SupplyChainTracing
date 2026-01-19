import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  // 后端 API 接口（流式）
  onSendMessage?: (
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) => Promise<void>;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ onSendMessage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '你好！我是供应链智能助手，可以帮助你分析供应链数据。有什么问题可以问我！',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // 发送消息（流式）
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    // 创建助手消息占位符
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 构建对话历史（排除初始欢迎消息和当前用户消息）
      const history = messages
        .filter(msg => msg.id !== '1') // 排除初始欢迎消息
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      if (onSendMessage) {
        // 使用流式 API
        let accumulatedContent = '';
        
        await onSendMessage(
          userInput,
          history,
          // onChunk: 每次收到新的内容块时调用
          (chunk: string) => {
            accumulatedContent += chunk;
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
            // 自动滚动到底部
            setTimeout(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 0);
          },
          // onComplete: 流式输出完成时调用
          () => {
            setIsLoading(false);
            setTimeout(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 0);
          },
          // onError: 发生错误时调用
          (error: string) => {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: `抱歉，发生了错误：${error}` }
                  : msg
              )
            );
            setIsLoading(false);
          }
        );
      } else {
        // 如果没有提供 onSendMessage，显示错误
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: '抱歉，AI 助手功能未正确配置。' }
              : msg
          )
        );
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error in handleSend:', error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: `抱歉，发生了错误：${error instanceof Error ? error.message : '未知错误'}` }
            : msg
        )
      );
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* 浮动按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-110 z-50"
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
      )}

      {/* 对话框 */}
      {isOpen && (
        <div
          ref={dialogRef}
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            zIndex: 1000
          }}
          className="w-96 h-[600px] bg-white rounded-[24px] shadow-2xl border border-black/5 flex flex-col overflow-hidden"
        >
          {/* 头部 */}
          <div className="bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-[16px]">AI 助手</h3>
                <p className="text-white/80 text-[11px]">供应链智能分析</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#F5F5F7]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-[18px] px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-white text-[#1D1D1F] border border-black/5'
                  }`}
                >
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <p className={`text-[10px] mt-1.5 ${
                    message.role === 'user' ? 'text-white/60' : 'text-[#86868B]'
                  }`}>
                    {message.timestamp.toLocaleTimeString('zh-CN', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-black/5 rounded-[18px] px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-[#86868B] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入框 */}
          <div className="p-4 bg-white border-t border-black/5">
            <div className="flex items-end gap-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入你的问题..."
                className="flex-1 resize-none rounded-[16px] border border-black/10 px-4 py-3 text-[14px] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all"
                rows={1}
                style={{
                  minHeight: '44px',
                  maxHeight: '120px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="w-11 h-11 bg-[#007AFF] rounded-full flex items-center justify-center hover:bg-[#0051D5] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;

