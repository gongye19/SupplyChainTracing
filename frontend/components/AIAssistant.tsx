import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../contexts/LanguageContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  initialOpen?: boolean;
  context?: string;
  // 保留 chunk 回调，便于后续把直接模型响应升级为流式输出。
  onSendMessage?: (
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) => Promise<void>;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ initialOpen = false, context, onSendMessage }) => {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: t('ai.welcome'),
      timestamp: new Date()
    }
  ]);
  
  // 当语言切换时，更新欢迎消息
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === '1') {
        return [{
          id: '1',
          role: 'assistant',
          content: t('ai.welcome'),
          timestamp: new Date()
        }];
      }
      return prev;
    });
  }, [language, t]);
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

  // 发送消息并等待 Northflank 后端直接调用实验室模型。
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

    // 创建助手消息占位符（不立即添加到消息列表，等有内容时再添加）
    const assistantMessageId = (Date.now() + 1).toString();
    let assistantMessageAdded = false;

    try {
      // 构建对话历史（排除初始欢迎消息和当前用户消息）
      const history = messages
        .filter(msg => msg.id !== '1') // 排除初始欢迎消息
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      if (onSendMessage) {
        // 当前后端一次性返回完整答案。
        let accumulatedContent = '';
        
        const contextualMessage = context
          ? `[Current dashboard context: ${context}]\n\n${userInput}`
          : userInput;
        await onSendMessage(
          contextualMessage,
          history,
          // onChunk: 每次收到新的内容块时调用
          (chunk: string) => {
            accumulatedContent += chunk;
            // 第一次收到内容时，添加助手消息到列表
            if (!assistantMessageAdded) {
              assistantMessageAdded = true;
              setMessages(prev => [...prev, {
                id: assistantMessageId,
                role: 'assistant',
                content: accumulatedContent,
                timestamp: new Date()
              }]);
            } else {
              // 更新已有消息的内容
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            }
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
            // 如果还没有添加消息，现在添加错误消息
            if (!assistantMessageAdded) {
              setMessages(prev => [...prev, {
                id: assistantMessageId,
                role: 'assistant',
                content: `抱歉，发生了错误：${error}`,
                timestamp: new Date()
              }]);
            } else {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: `抱歉，发生了错误：${error}` }
                    : msg
                )
              );
            }
            setIsLoading(false);
          }
        );
      } else {
        // 如果没有提供 onSendMessage，显示错误
        setMessages(prev => [...prev, {
          id: assistantMessageId,
          role: 'assistant',
          content: '抱歉，AI 助手功能未正确配置。',
          timestamp: new Date()
        }]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error in handleSend:', error);
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: `抱歉，发生了错误：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date()
      }]);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 清空聊天记录
  const handleClearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: t('ai.welcome'),
        timestamp: new Date()
      }
    ]);
  };

  return (
    <>
      {/* 浮动按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="workspace-assistant-launcher"
          aria-label={t('ai.assistant')}
        >
          <MessageCircle className="w-6 h-6 text-white" />
        </button>
      )}

      {/* 对话框 */}
      {isOpen && (
        <div
          ref={dialogRef}
          className="assistant-panel"
          role="dialog"
          aria-label={t('ai.assistant')}
        >
          {/* 头部 */}
          <div className="assistant-panel-header">
            <div className="flex items-center gap-3">
              <div className="assistant-panel-icon">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3>{t('ai.assistant')}</h3>
                <p><span /> {language === 'zh' ? '实验室模型已连接' : 'Laboratory model connected'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearChat}
                className="assistant-icon-button"
                title={t('ai.clearChat')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="assistant-icon-button"
                title={t('ai.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {context && (
            <div className="assistant-context">
              <span>{language === 'zh' ? '当前页面上下文' : 'Current view context'}</span>
              <p>{context}</p>
            </div>
          )}

          {/* 消息列表 */}
          <div className="assistant-messages custom-scrollbar">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`assistant-message ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}
                >
                  {message.content && (
                    <div className={`text-[14px] leading-relaxed ${message.role === 'assistant' ? 'prose prose-sm max-w-none' : ''}`}>
                      {message.role === 'assistant' ? (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 text-[#1D1D1F]">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0 text-[#1D1D1F]">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0 text-[#1D1D1F]">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-3 first:mt-0 text-[#1D1D1F]">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-[#1D1D1F]">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-[#1D1D1F]">{children}</ol>,
                            li: ({ children }) => <li className="ml-2">{children}</li>,
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[13px] font-mono text-[#1D1D1F]">{children}</code>
                              ) : (
                                <code className="block bg-[#F5F5F7] p-2 rounded text-[13px] font-mono overflow-x-auto text-[#1D1D1F]">{children}</code>
                              );
                            },
                            pre: ({ children }) => <pre className="bg-[#F5F5F7] p-2 rounded text-[13px] font-mono overflow-x-auto mb-2 text-[#1D1D1F]">{children}</pre>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-[#007AFF]/30 pl-3 italic my-2 text-[#1D1D1F]">{children}</blockquote>,
                            a: ({ children, href }) => <a href={href} className="text-[#007AFF] underline hover:text-[#0051D5]" target="_blank" rel="noopener noreferrer">{children}</a>,
                            strong: ({ children }) => <strong className="font-bold text-[#1D1D1F]">{children}</strong>,
                            em: ({ children }) => <em className="italic text-[#1D1D1F]">{children}</em>,
                            hr: () => <hr className="my-3 border-black/10" />,
                            table: ({ children }) => <div className="overflow-x-auto my-2"><table className="min-w-full border-collapse">{children}</table></div>,
                            th: ({ children }) => <th className="border border-black/10 px-2 py-1 bg-[#F5F5F7] font-bold text-left">{children}</th>,
                            td: ({ children }) => <td className="border border-black/10 px-2 py-1">{children}</td>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap text-white">{message.content}</p>
                      )}
                    </div>
                  )}
                  <p className="assistant-message-time">
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
                <div className="assistant-message is-assistant">
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
          <div className="assistant-composer">
            <div className="assistant-composer-row">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={t('ai.placeholder')}
                className="assistant-input"
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
                className="assistant-send"
                aria-label={language === 'zh' ? '发送问题' : 'Send question'}
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
