import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([
    { text: 'Hello, how can I help you today?', sender: 'bot', isTyping: false }
  ])
  const [inputText, setInputText] = useState('')
  const [latestBotMessageId, setLatestBotMessageId] = useState(null) // Track the latest bot message
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // This effect ensures the scrollbar appears at the edge
  useEffect(() => {
    // Force recalculation of scrollbar position
    if (messagesContainerRef.current) {
      messagesContainerRef.current.style.overflowY = 'hidden'
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.style.overflowY = 'auto'
        }
      }, 0)
    }
  }, [])

  const handleSendMessage = (e) => {
    e.preventDefault()
    
    if (!inputText.trim()) return
    
    // Add user message
    const updatedMessages = [
      ...messages, 
      { text: inputText, sender: 'user' }
    ]
    setMessages(updatedMessages)
    setInputText('')
    
    // Show bot typing indicator
    setTimeout(() => {
      // Get bot response
      const botResponse = getBotResponse(inputText)
      
      // Generate a unique ID for this message
      const newMessageId = Date.now().toString()
      
      // Add bot message with typing animation
      setMessages([
        ...updatedMessages,
        { 
          id: newMessageId,
          text: botResponse, 
          sender: 'bot',
          isTyping: true
        }
      ])
      
      // Set this as the latest bot message to animate
      setLatestBotMessageId(newMessageId)
      
      // After typing animation completes (based on message length), clear the animation flag
      const typingDuration = Math.min(botResponse.split(' ').length * 100 + 500, 3000)
      
      setTimeout(() => {
        setLatestBotMessageId(null)
      }, typingDuration)
    }, 600)
  }
  
  const getBotResponse = (text) => {
    // Simple response logic - could be replaced with an actual API call
    const lowerText = text.toLowerCase()
    
    if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return 'Hello! How can I assist you today?'
    } else if (lowerText.includes('help')) {
      return 'I can answer questions or provide information. What would you like to know?'
    } else if (lowerText.includes('bye')) {
      return 'Goodbye! Have a wonderful day!'
    } else {
      return "I'm still learning. Could you try asking in a different way?"
    }
  }

  // Component for displaying a word with typing animation
  const TypingWord = ({ word, index }) => {
    const [visible, setVisible] = useState(false)
    
    useEffect(() => {
      const timeout = setTimeout(() => {
        setVisible(true)
      }, index * 100) // Adjust timing between words
      
      return () => clearTimeout(timeout)
    }, [index])
    
    return (
      <span className="typing-word" style={{ opacity: visible ? 1 : 0 }}>
        {word}{' '}
      </span>
    )
  }

  // Component for rendering messages
  const MessageContent = ({ message }) => {
    // Only animate the latest bot message
    if (message.sender === 'bot' && message.id === latestBotMessageId) {
      const words = message.text.split(' ')
      
      return (
        <div className="typing-animation">
          {words.map((word, index) => (
            <TypingWord key={index} word={word} index={index} />
          ))}
        </div>
      )
    }
    
    return <>{message.text}</>
  }

  return (
    <div className="chat-app">
      <div className="chat-container">
        <div className="welcome-header">
          <div className="welcome-icon"></div>
          <h1 className="welcome-text">Hello, how can I help?</h1>
        </div>
        
        <div className="messages-container" ref={messagesContainerRef}>
          <div className="content-wrapper">
            {messages.map((message, index) => (
              <div 
                key={message.id || index} 
                className={`message ${message.sender}`}
              >
                <MessageContent message={message} />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        <div className="input-wrapper">
        <form className="input-area" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message..."
            className="message-input"
          />
          <button type="submit" className="send-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
        </div>
      </div>
    </div>
  )
}

export default App