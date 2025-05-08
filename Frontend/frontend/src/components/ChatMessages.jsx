import { useState, useEffect, useRef } from 'react';
import { chatHistoryApi } from '../api/chatHistoryApi';

/**
 * Component to display messages in a chat and add new messages
 */
const ChatMessages = ({ chatId }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load messages when chatId changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!chatId) return;
      
      try {
        setLoading(true);
        const response = await chatHistoryApi.getChatById(chatId);
        
        if (response.success) {
          setMessages(response.data.messages || []);
        } else {
          setError('Failed to load messages');
        }
      } catch (error) {
        setError('Error loading messages: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [chatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputText.trim() || !chatId) return;
    
    try {
      setSending(true);
      
      // Add user message
      const userMessage = {
        text: inputText,
        sender: 'user',
        html: false
      };
      
      // First optimistically update the UI
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setInputText('');
      
      // Then send to the API
      await chatHistoryApi.addMessage(chatId, userMessage);
      
      // Here you would normally handle the bot response
      // This is just a placeholder to demonstrate the API
      const botMessage = {
        text: `Echo: ${inputText}`,
        sender: 'bot',
        html: false
      };
      
      // Again update UI optimistically
      setMessages(prevMessages => [...prevMessages, botMessage]);
      
      // Then send to API
      await chatHistoryApi.addMessage(chatId, botMessage);
      
    } catch (error) {
      setError('Error sending message: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  if (!chatId) return <div className="no-chat-selected">Select a chat to start messaging</div>;
  if (loading) return <div className="loading">Loading messages...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="chat-messages-container">
      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="empty-messages">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.sender}`}
            >
              {message.html ? (
                <div dangerouslySetInnerHTML={{ __html: message.text }} />
              ) : (
                <div>{message.text}</div>
              )}
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="message-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type your message..."
          disabled={sending}
        />
        <button type="submit" disabled={sending || !inputText.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default ChatMessages; 