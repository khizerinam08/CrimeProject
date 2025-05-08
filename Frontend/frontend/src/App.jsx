import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'
import MapModal from './components/MapModal'
import TimeSelector from './components/TimeSelector'
import axios from 'axios'

function App() {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentBotMessage, setCurrentBotMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true) // Default open to match image
  const [activeChat, setActiveChat] = useState(null)
  const [currentChatId, setCurrentChatId] = useState(null)
  const [chatList, setChatList] = useState([])
  const [loadingChats, setLoadingChats] = useState(false)
  
  // State for location selection flow
  const [showMapModal, setShowMapModal] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [awaitingLocation, setAwaitingLocation] = useState(false)
  const [awaitingTimeDay, setAwaitingTimeDay] = useState(false)
  const [validatedTime, setValidatedTime] = useState(null)
  const [validatedDay, setValidatedDay] = useState(null)
  const [crimePredictionInProgress, setCrimePredictionInProgress] = useState(false)
  
  // Add this new API URL for the MongoDB backend
  const MONGO_API_URL = 'http://localhost:5000/api'
  
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  // API base URL - change this to match your FastAPI server
  const API_URL = 'http://localhost:8000'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentBotMessage])

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

  // Update document class when sidebar state changes
  useEffect(() => {
    // This helps with CSS transitions for the input wrapper
    document.body.classList.toggle('sidebar-open', sidebarOpen);
  }, [sidebarOpen]);

  // Remove the initial greeting and user message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([]);
    }
  }, []);

  // Add this effect to create or load a chat when the app starts
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Check if we have a chatId in localStorage
        const storedChatId = localStorage.getItem('currentChatId')
        
        if (storedChatId && chatList.length > 0) {
          // Find the chat in our list
          const chat = chatList.find(c => c.chatId === storedChatId)
          if (chat) {
            // Select this chat
            selectChat(chat.chatId, chat.title)
            return
          }
        }
        
        // If no stored chat or it wasn't found, select the first chat if available
        if (chatList.length > 0) {
          selectChat(chatList[0].chatId, chatList[0].title)
        }
      } catch (error) {
        console.error('Error initializing chat:', error)
      }
    }
    
    if (chatList.length > 0 && !currentChatId) {
      initializeChat()
    }
  }, [chatList])
  
  // Add this function to save a message to MongoDB
  const saveMessageToMongo = async (message) => {
    if (!currentChatId) return
    
    try {
      await axios.put(`${MONGO_API_URL}/chats/${currentChatId}/messages`, message)
    } catch (error) {
      console.error('Error saving message to MongoDB:', error)
    }
  }

  // Stream/typing effect for any bot message (including initial greeting)
  const streamBotMessage = async (fullText, isHTML = false) => {
    setIsTyping(true);
    setCurrentBotMessage("");
    let displayed = "";
    
    // Generate a unique ID for this message
    const messageId = Date.now().toString();
    
    // If it's HTML content, display it instantly without typing animation
    if (isHTML) {
      const htmlMessage = { 
        text: fullText, 
        sender: 'bot', 
        id: messageId,
        html: true 
      }
      
      setMessages(messages => [
        ...messages,
        htmlMessage
      ]);
      
      // Save the HTML message to MongoDB
      await saveMessageToMongo(htmlMessage)
      
      setIsTyping(false);
      return messageId;
    }
    
    // For regular text, add empty message to start
    setMessages(messages => [
      ...messages,
      { 
        text: "", 
        sender: 'bot', 
        id: messageId,
        html: false 
      }
    ]);
    
    // Determine message length for dynamic typing speed
    const messageLength = fullText.length;
    
    // Create human-like typing speed variations
    // Shorter messages are typed faster than longer ones
    const getCharacterDelay = (char, prevChar, index) => {
      // Base delay adjusted by message length (faster overall)
      let baseDelay = messageLength > 100 ? 15 : 20;
      
      // Add randomness (±30%)
      const randomFactor = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3
      
      // Slow down for punctuation and new sentences (but less than before)
      if ('.!?'.includes(prevChar)) {
        return 300 * randomFactor; // Shorter pause after sentence end
      } else if (',;:'.includes(prevChar)) {
        return 120 * randomFactor; // Shorter pause after commas, semicolons
      } else if (prevChar === '\n' || (prevChar === ' ' && '.!?'.includes(fullText[index-2]))) {
        return 150 * randomFactor; // Shorter pause for new lines or spaces after sentences
      }
      
      // Realistic typing flow - occasionally pause as if thinking (less frequently)
      if (index > 5 && index % 80 === 0) {
        return 200 * randomFactor; // Occasional thinking pause
      }
      
      // Speed bursts and slow-downs to mimic human typing
      if (Math.random() < 0.05) {
        // 5% chance of a typing burst or slowdown (reduced from 10%)
        return Math.random() < 0.5 ? 
          baseDelay * 0.5 * randomFactor : // Burst (faster)
          baseDelay * 1.5 * randomFactor;  // Slowdown (less slow)
      }
      
      return baseDelay * randomFactor;
    };
    
    // Stream character by character with realistic timing
    let prevChar = '';
    for (let i = 0; i < fullText.length; i++) {
      const currentChar = fullText[i];
      displayed += currentChar;
      setCurrentBotMessage(displayed);
      
      // Update the message in state in real-time
      setMessages(messages => 
        messages.map(msg => 
          msg.id === messageId ? { ...msg, text: displayed } : msg
        )
      );
      
      // Calculate delay for more realism with pauses
      const delay = getCharacterDelay(currentChar, prevChar, i);
      await new Promise(res => setTimeout(res, delay));
      
      prevChar = currentChar;
    }
    
    // After the typing effect completes, save the final message to MongoDB
    const finalMessage = {
      text: fullText,
      sender: 'bot',
      html: false
    }
    await saveMessageToMongo(finalMessage)
    
    setIsTyping(false);
    setCurrentBotMessage("");
    
    return messageId;
  };

  // Function to detect if user is asking about crime rates
  const isCrimeRateRequest = (text) => {
    // If we're awaiting location, we want to check for addresses first
    // So return false here to allow address detection to happen
    if (awaitingLocation) {
      return false;
    }
    
    const lowerText = text.toLowerCase().trim();
    
    // Expanded list of crime-related keywords
    const crimeKeywords = [
      'crime', 'crimes', 'criminal', 
      'safety', 'safe', 'secure', 'security',
      'danger', 'dangerous', 'risk', 'risky',
      'theft', 'robbery', 'assault', 'murder',
      'burglary', 'shooting', 'violence'
    ];
    
    // Location/place related keywords 
    const locationKeywords = [
      'location', 'place', 'area', 'where', 'map',
      'neighborhood', 'district', 'street', 'city',
      'region', 'zone', 'spot', 'address', 'there',
      'coordinate', 'coordinates', 'position', 'point',
      'locale', 'venue'
    ];
    
    // Simple action phrases (like "find crime")
    const simpleActionPhrases = [
      'find crime', 'find the crime', 'find crime rate', 
      'crime rate', 'crime rates', 'crime prediction',
      'check crime', 'check safety', 'how safe',
      'is it safe', 'safety level', 'danger level',
      'crime statistics', 'risk assessment'
    ];
    
    // Check for simple phrases first (highest priority)
    for (const phrase of simpleActionPhrases) {
      if (lowerText.includes(phrase)) {
        return true;
      }
    }
    
    // Single-word crime queries
    if (crimeKeywords.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lowerText);
    })) {
      return true;
    }
    
    // Check for combinations of crime and location terms
    const hasCrimeKeyword = crimeKeywords.some(keyword => lowerText.includes(keyword));
    const hasLocationKeyword = locationKeywords.some(keyword => lowerText.includes(keyword));
    
    return hasCrimeKeyword && hasLocationKeyword;
  };

  // Function to detect if user wants to cancel or change topic
  const isChangingTopic = (text) => {
    const lowerText = text.toLowerCase();
    const cancelKeywords = [
      'cancel', 
      'stop', 
      'forget it', 
      'never mind', 
      'nevermind', 
      'change topic', 
      'talk about something else',
      'different topic',
      'different question',
      'different location',
      'other location',
      'another place'
    ];
    
    return cancelKeywords.some(keyword => lowerText.includes(keyword));
  };

  // Function to detect if user is asking for a restart or new prediction
  const isRequestingNewPrediction = (text) => {
    const lowerText = text.toLowerCase();
    const restartKeywords = [
      'restart', 
      'start over', 
      'new prediction', 
      'try again',
      'different place',
      'different location',
      'another place',
      'another prediction',
      'new search',
      'start new'
    ];
    
    return restartKeywords.some(keyword => lowerText.includes(keyword));
  };

  // Function to parse and validate time from user input
  const parseTime = (text) => {
    const lowerText = text.toLowerCase();
    // Look for time pattern: 1pm, 1:30pm, 13:00, etc.
    const timePatterns = [
      /(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)?/i, // 1:30pm or 13:00
      /(\d{1,2})\s*(am|pm)/i                 // 1pm
    ];
    
    let hour = null;
    let minute = 0;
    
    // Try each pattern
    for (const pattern of timePatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        // First pattern with HH:MM format
        if (match[2] && match[3]) {
          hour = parseInt(match[1]);
          minute = parseInt(match[2]);
          
          // Convert to 24-hour if AM/PM is specified
          if (match[3] && match[3].toLowerCase() === 'pm' && hour < 12) {
            hour += 12;
          } else if (match[3] && match[3].toLowerCase() === 'am' && hour === 12) {
            hour = 0;
          }
        } 
        // Second pattern with just hour and AM/PM
        else if (match[2] && !match[3]) {
          hour = parseInt(match[1]);
          
          // Convert to 24-hour if AM/PM is specified
          if (match[2].toLowerCase() === 'pm' && hour < 12) {
            hour += 12;
          } else if (match[2].toLowerCase() === 'am' && hour === 12) {
            hour = 0;
          }
        }
        break;
      }
    }
    
    // Look for 24-hour time without AM/PM
    if (hour === null) {
      const militaryMatch = lowerText.match(/(\d{1,2})(?::(\d{2}))?/);
      if (militaryMatch) {
        hour = parseInt(militaryMatch[1]);
        minute = militaryMatch[2] ? parseInt(militaryMatch[2]) : 0;
        
        // If hour is clearly in 24-hour format
        if (hour > 12 && hour <= 23) {
          // Already in 24-hour format
        } 
        // If it's ambiguous, look for context clues
        else if (hour <= 12) {
          // Look for "evening", "night", etc. to determine if PM
          const eveningKeywords = ['evening', 'night', 'tonight', 'p.m.', 'p.m', 'pm', 'afternoon'];
          const isEvening = eveningKeywords.some(keyword => lowerText.includes(keyword));
          
          if (isEvening && hour < 12) {
            hour += 12;
          }
        }
      }
    }
    
    // Validate hour and minute
    if (hour !== null) {
      if (hour < 0 || hour > 23) {
        return { isValid: false, error: `Invalid hour: ${hour}. Please specify an hour between 0-23.` };
      }
      
      if (minute < 0 || minute > 59) {
        return { isValid: false, error: `Invalid minute: ${minute}. Please specify minutes between 0-59.` };
      }
      
      // Format for display
      const period = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      const displayTime = `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
      
      return { 
        isValid: true, 
        hour, 
        minute, 
        displayTime 
      };
    }
    
    return { isValid: false, error: "I couldn't understand the time format. Please specify a time like '3:30 PM' or '15:30'." };
  };

  // Function to parse and validate day from user input
  const parseDay = (text) => {
    const lowerText = text.toLowerCase();
    const days = [
      { name: 'monday', index: 0 },
      { name: 'tuesday', index: 1 },
      { name: 'wednesday', index: 2 },
      { name: 'thursday', index: 3 },
      { name: 'friday', index: 4 },
      { name: 'saturday', index: 5 },
      { name: 'sunday', index: 6 }
    ];
    
    // Also check for day abbreviations
    const dayAbbreviations = {
      'mon': 0, 'm': 0,
      'tue': 1, 'tues': 1, 't': 1,
      'wed': 2, 'weds': 2, 'w': 2,
      'thu': 3, 'thur': 3, 'thurs': 3, 'th': 3,
      'fri': 4, 'f': 4,
      'sat': 5, 's': 5, 'sa': 5,
      'sun': 6, 'su': 6
    };
    
    // Check for full day names
    for (const day of days) {
      if (lowerText.includes(day.name)) {
        return { 
          isValid: true, 
          day: day.index,
          displayDay: day.name.charAt(0).toUpperCase() + day.name.slice(1)
        };
      }
    }
    
    // Check for abbreviations
    for (const [abbr, index] of Object.entries(dayAbbreviations)) {
      // Use word boundaries to avoid matching substrings
      const regex = new RegExp(`\\b${abbr}\\b`, 'i');
      if (regex.test(lowerText)) {
        const fullDay = days.find(d => d.index === index).name;
        return { 
          isValid: true, 
          day: index,
          displayDay: fullDay.charAt(0).toUpperCase() + fullDay.slice(1)
        };
      }
    }
    
    // If we get here, we didn't find a valid day
    return { 
      isValid: false, 
      error: "I couldn't understand the day. Please specify a day of the week like 'Monday' or 'Friday'."
    };
  };

  // Function to detect address patterns in text - simple version
  const detectAddress = (text) => {
    if (!text) return null;
    
    console.log("Using simple address detection for:", text);
    
    // Clean the text first to remove common prefix phrases
    let cleanedInput = text
      .replace(/\b(?:the\s+location|the\s+address|location|address|place|area|neighborhood|spot|zone)\s+(?:at|of|in|near|around)?\s+/gi, '')
      .replace(/\b(?:at|in|near|around)\s+(?:the\s+)?(?:location|address|place|area|neighborhood|spot|zone)\s+/gi, '')
      .trim();
      
    console.log("Input after prefix removal:", cleanedInput);
    
    // Common address patterns
    const addressPatterns = [
      // Street number + street name
      /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|court|ct|lane|ln|place|pl|square|sq|highway|hwy|parkway|pkwy|circle|cir|trail|trl|way)\b/i,
      
      // City, State or City, Country pattern - more permissive
      /\b([A-Za-z\s]+),\s*([A-Za-z\s]{2,})\b/i,
      
      // ZIP/Postal codes
      /\b[A-Za-z\s]+\s+\d{5}(?:-\d{4})?\b/i, // US ZIP
      
      // Extract location from "at [location]" pattern - very common in queries
      /\bat\s+([^.?!]+)/i,
      /\bin\s+([^.?!]+)/i,
      /\bnear\s+([^.?!]+)/i,
      /\baround\s+([^.?!]+)/i,
    ];
    
    // First, check for Chicago-specific addresses in the cleaned input
    if (/chicago|illinois|il/i.test(cleanedInput)) {
      console.log("Chicago reference found in cleaned input");
      
      // Try to extract just the address part by removing question context
      let potentialAddress = cleanedInput
        .replace(/what'?s\s+the\s+crime\s+(?:rate|risk|level|percentage|%)\s+(?:at|in|of|near|around)?\s+/gi, '')
        .replace(/how\s+(?:safe|dangerous|risky)\s+is\s+(?:it|the\s+area)?\s+(?:at|in|of|near|around)?\s+/gi, '')
        .replace(/(?:tell|show)\s+me\s+(?:the\s+)?(?:crime|safety|risk)\s+(?:rate|risk|level|percentage|%)\s+(?:at|in|of|near|around)?\s+/gi, '')
        .replace(/\?/g, '')
        .trim();
      
      console.log("Potential Chicago address:", potentialAddress);
      return potentialAddress;
    }
    
    // Look for matches using the patterns in the cleaned input
    for (const pattern of addressPatterns) {
      const match = cleanedInput.match(pattern);
      if (match) {
        console.log("Address match found:", match[1] || match[0]);
        // Use the capture group if it exists, otherwise use the whole match
        return match[1] || match[0];
      }
    }
    
    // If no matches, try with original text as fallback
    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match) {
        console.log("Address match found in original text:", match[1] || match[0]);
        return match[1] || match[0];
      }
    }
    
    // Finally, check if the entire text (minus crime inquiry parts) might be an address
    const withoutCrimeText = cleanedInput
      .replace(/crime rate/gi, '')
      .replace(/crime risk/gi, '')
      .replace(/crime/gi, '')
      .replace(/safety/gi, '')
      .replace(/danger/gi, '')
      .replace(/risk/gi, '')
      .replace(/what's/gi, '')
      .replace(/whats/gi, '')
      .replace(/what is/gi, '')
      .replace(/how safe is/gi, '')
      .replace(/the/gi, '')
      .replace(/\?/g, '')
      .replace(/\./g, '')
      .trim();
      
    if (withoutCrimeText && withoutCrimeText.length > 5) {
      console.log("Trying cleaned text as address:", withoutCrimeText);
      return withoutCrimeText;
    }
    
    return null;
  };

  // Function to extract a location from the query text (location extraction only, no geocoding)
  const extractLocationFromQuery = (text) => {
    if (!text) return null;
    
    // Extract address using the simple detector
    const address = detectAddress(text);
    if (address) {
      return address;
    }
    
    return null;
  };

  // Handle direct crime queries with location
  const handleCrimeRateWithLocation = async (text) => {
    console.log("Handling crime rate query with location:", text);
    const locationText = extractLocationFromQuery(text);
    
    if (!locationText) {
      // No location found, proceed with standard flow
      await streamBotMessage("I can help you find the crime rate for a specific location. Please select a location on the map below.", true);
      
      // Set state to indicate we're waiting for location
      setAwaitingLocation(true);
      
      // Add map to chat
      setTimeout(() => {
        setMessages(messages => [
          ...messages,
          { 
            sender: 'bot', 
            isEmbeddedMap: true,
            id: Date.now().toString()
          }
        ]);
      }, 500);
      
      return;
    }
    
    console.log("Extracted location reference:", locationText);
    
    // When a location is mentioned in text, we'll just ask the user to select on map
    await streamBotMessage(`I see you mentioned a location. Please select the exact spot on the map below:`, true);
    
    // Set state to indicate we're waiting for location
    setAwaitingLocation(true);
    
    // Add map to chat
    setTimeout(() => {
      setMessages(messages => [
        ...messages,
        { 
          sender: 'bot', 
          isEmbeddedMap: true,
          id: Date.now().toString()
        }
      ]);
    }, 500);
  };

  // Process crime prediction with validated time and day
  const processCrimePrediction = useCallback(async () => {
    if (!selectedLocation || !validatedTime || !validatedDay || crimePredictionInProgress) {
      console.log("Missing required data for prediction:", { 
        hasLocation: !!selectedLocation, 
        hasTime: !!validatedTime, 
        hasDay: !!validatedDay 
      });
      return;
    }
    
    try {
      setCrimePredictionInProgress(true);
      
      // Show loading message - use regular typing for this
      await streamBotMessage("Calculating crime risk prediction...");
      
      // Prepare data for API call
      const predictionData = {
        lat: selectedLocation[0],
        lon: selectedLocation[1],
        hour: validatedTime.hour,
        weekday: validatedDay.day
      };
      
      console.log("Sending prediction request to API:", predictionData);
      
      // Make API call to backend
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(predictionData)
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const result = await response.json();
      
      console.log("Received prediction result:", result);
      
      // Extract probability from result
      const probability = result.probability || "0.00%";
      
      // Determine risk level for styling based on probability value
      const probValue = parseFloat(probability);
      let riskLevel = "low";
      if (probValue > 70) {
        riskLevel = "high";
      } else if (probValue > 40) {
        riskLevel = "medium";
      }
      
      // Format response message with risk level
      const resultMessage = `
        <div class="prediction-result">
          <div class="prediction-header">Crime Risk Prediction</div>
          <div class="prediction-details">
            <div class="prediction-location">Location: ${selectedLocation[0].toFixed(6)}, ${selectedLocation[1].toFixed(6)}</div>
            <div class="prediction-time">Time: ${validatedTime.displayTime} on ${validatedDay.displayDay}</div>
            <div class="prediction-risk">
              Risk Level: <span class="crime-prediction ${riskLevel}">${probability}</span>
            </div>
          </div>
        </div>
      `;
      
      // Send the HTML result with isHTML=true to make it appear instantly
      await streamBotMessage(resultMessage, true);
      
      // Reset the flow
      setAwaitingTimeDay(false);
      setValidatedTime(null);
      setValidatedDay(null);
      
    } catch (error) {
      console.error("Error generating crime prediction:", error);
      await streamBotMessage("Sorry, I encountered an error calculating the crime risk. Please try again.");
    } finally {
      setCrimePredictionInProgress(false);
    }
  }, [selectedLocation, validatedTime, validatedDay, crimePredictionInProgress, streamBotMessage, API_URL]);

  // When both time and day are validated, process the crime prediction
  useEffect(() => {
    if (validatedTime && validatedDay && selectedLocation && !crimePredictionInProgress) {
      processCrimePrediction();
    }
  }, [validatedTime, validatedDay, selectedLocation, crimePredictionInProgress, processCrimePrediction]);

  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!inputText.trim()) return
    
    const userTextInput = inputText.trim();
    
    // Create user message object
    const userMessage = { text: userTextInput, sender: 'user' }
    
    // Add user message to UI
    const updatedMessages = [
      ...messages, 
      userMessage
    ]
    setMessages(updatedMessages)
    setInputText('')
    setIsLoading(true) // Set loading state
    
    // Save user message to MongoDB
    await saveMessageToMongo(userMessage)
    
    // Check if user wants to cancel or change topic
    if (isChangingTopic(userTextInput)) {
      // Reset all crime prediction states
      setAwaitingLocation(false);
      setAwaitingTimeDay(false);
      setValidatedTime(null);
      setValidatedDay(null);
      setSelectedLocation(null);
      
      const botResponse = {
        text: "I understand you want to change the topic. What would you like to talk about instead?",
        sender: 'bot',
        html: true
      }
      
      // Add bot message to UI
      setMessages([...updatedMessages, botResponse])
      
      // Save bot message to MongoDB
      await saveMessageToMongo(botResponse)
      
      setIsLoading(false);
      return;
    }
    
    // Check if user wants to start a new prediction
    if (isRequestingNewPrediction(userTextInput)) {
      // Reset prediction states but keep the crime flow active
      setAwaitingLocation(true);
      setAwaitingTimeDay(false);
      setValidatedTime(null);
      setValidatedDay(null);
      setSelectedLocation(null);
      
      await streamBotMessage("Let's start a new crime prediction. Please select a location on the map below.", true);
      
      // Add map to chat for new location selection
      setTimeout(() => {
        setMessages(messages => [
          ...messages,
          { 
            sender: 'bot', 
            isEmbeddedMap: true,
            id: Date.now().toString()
          }
        ]);
      }, 500);
      
      setIsLoading(false);
      return;
    }
    
    // Check if awaiting location (user initiated crime rate flow)
    if (awaitingLocation) {
      // Check if there's an address in the text
      const addressText = detectAddress(userTextInput);
      
      if (addressText) {
        // Instead of geocoding, just prompt the user to select on the map
        await streamBotMessage(`If you want to check the crime, please select the exact spot on the map below:`, true);
        setIsLoading(false);
        return;
      }
      
      // Check if this is a crime rate request with new parameters
      if (isCrimeRateRequest(userTextInput)) {
        // Keep awaitingLocation true but update the message
        await streamBotMessage("Please select a location on the map below for your crime rate prediction.", true);
        setIsLoading(false);
        return;
      }
      
      // If they've typed a message instead of using the map, remind them to use the map
      // but in a conversational way that allows them to change their mind
      await streamBotMessage("To get a crime rate prediction, please select a location on the map below. Or if you'd like to talk about something else, just let me know.", true);
      setIsLoading(false);
      return;
    }
    
    // Check if awaiting time/day (location already selected)
    if (awaitingTimeDay) {
      // Check if this is a new crime rate request
      if (isCrimeRateRequest(userTextInput)) {
        // Reset and start over with location selection
        setAwaitingLocation(true);
        setAwaitingTimeDay(false);
        setValidatedTime(null);
        setValidatedDay(null);
        setSelectedLocation(null);
        
        await streamBotMessage("Let's look at a different location for the crime rate. Please select a location on the map below.", true);
        
        // Add map to chat for new location selection
        setTimeout(() => {
          setMessages(messages => [
            ...messages,
            { 
              sender: 'bot', 
              isEmbeddedMap: true,
              id: Date.now().toString()
            }
          ]);
        }, 500);
        
        setIsLoading(false);
        return;
      }
      
      const userInput = userTextInput.trim();
      
      // Try to parse time and day from the input
      const timeResult = parseTime(userInput);
      const dayResult = parseDay(userInput);
      
      // If we found both time and day, process them
      if (timeResult.isValid && dayResult.isValid) {
        setValidatedTime(timeResult);
        setValidatedDay(dayResult);
        
        // Acknowledgment message - no need to add separately as user message
        await streamBotMessage(`I've recognized the time as ${timeResult.displayTime} on ${dayResult.displayDay}.`, true);
        setIsLoading(false);
        return;
      }
      
      // If only time is valid, ask for day
      if (timeResult.isValid && !dayResult.isValid) {
        setValidatedTime(timeResult);
        await streamBotMessage(`I've recognized the time as ${timeResult.displayTime}. Now, please tell me which day of the week. Or if you'd like to start over or talk about something else, just let me know.`, true);
        setIsLoading(false);
        return;
      }
      
      // If only day is valid, ask for time
      if (!timeResult.isValid && dayResult.isValid) {
        setValidatedDay(dayResult);
        await streamBotMessage(`I've recognized the day as ${dayResult.displayDay}. Now, please tell me what time. Or if you'd like to start over or talk about something else, just let me know.`, true);
        setIsLoading(false);
        return;
      }
      
      // If neither is valid, give guidance but mention they can change topics
      await streamBotMessage("I couldn't understand the time and day from your message. Please specify a time (like '3:30 PM') and a day (like 'Monday'). Or if you'd like to talk about something else, just let me know.", true);
      setIsLoading(false);
      return;
    }
    
    try {
      // Check if this is a crime rate request
      if (isCrimeRateRequest(userTextInput)) {
        // Try to handle as a direct crime rate query with location
        await handleCrimeRateWithLocation(userTextInput);
        setIsLoading(false);
        return;
      }
      
      // Standard chat flow - add an empty bot message that will be updated
      const emptyBotMessage = { text: "", sender: 'bot', id: Date.now().toString() }
      setMessages([
        ...updatedMessages,
        emptyBotMessage
      ])
      
      setIsTyping(true)
      setCurrentBotMessage("")
      
      // Get bot response using streaming
      const response = await getStreamingBotResponse(userTextInput)
      
      // Once streaming is complete, save the final message
      const finalBotMessage = { 
        text: response.text, 
        sender: 'bot',
        html: false
      }
      await saveMessageToMongo(finalBotMessage)
      
    } catch (error) {
      // Handle error - stream error message to chat
      const errorMessage = { 
        text: "Sorry, I encountered an error. Please try again.", 
        sender: 'bot', 
        html: true 
      }
      await streamBotMessage("Sorry, I encountered an error. Please try again.", true);
      await saveMessageToMongo(errorMessage)
      console.error("Error getting bot response:", error)
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }
  
  // Handler for map location selection
  const handleLocationSelected = (coordinates) => {
    setSelectedLocation(coordinates);
    setAwaitingLocation(false);
    setAwaitingTimeDay(true);
    
    // Instead of adding a user message, add a bot message acknowledging the selection
    setTimeout(async () => {
      await streamBotMessage(`I see you've selected a location at coordinates ${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}. Now please tell me what time and day you'd like the crime prediction for. For example, '9:30 PM on Friday'. You can also say 'different location' if you want to choose another place.`, true);
    }, 300);
  };
  
  // Handler for time/day selection from modal (fallback)
  const handleTimeDaySelected = async (timeDay) => {
    // Convert the timeDay object to our validated format
    setValidatedTime({
      isValid: true,
      hour: timeDay.hour,
      minute: timeDay.minute || 0,
      displayTime: timeDay.displayTime
    });
    
    setValidatedDay({
      isValid: true,
      day: timeDay.day,
      displayDay: timeDay.displayDay
    });
    
    // Instead of adding a user message, let the normal processCrimePrediction flow handle it
    // The validation effect will trigger the prediction now that both validatedTime and validatedDay are set
  };
  
  const getStreamingBotResponse = async (text) => {
    try {
      console.log("Sending message to backend API:", text);
      
      // If no session ID exists, create one for this conversation
      const currentSessionId = sessionId || `session-${Date.now()}`;
      if (!sessionId) {
        setSessionId(currentSessionId);
      }
      
      // Prepare data for the API call
      const chatData = {
        message: text,
        session_id: currentSessionId,
        stream: true
      };
      
      // Initial empty response
      let fullResponse = "";
      setCurrentBotMessage("");
      
      // Make the streaming request to the backend
      console.log("Making streaming request to:", `${API_URL}/chat`);
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatData)
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      // Get the response as a stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Process the stream
      while (true) {
        const { value, done } = await reader.read();
        
        if (done) {
          console.log("Stream completed, full response:", fullResponse);
          break;
        }
        
        // Decode the chunk
        const chunk = decoder.decode(value);
        console.log("Received chunk:", chunk);
        
        // Process each line (the API returns newline-separated JSON)
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          try {
            const jsonResponse = JSON.parse(line);
            
            if (jsonResponse.chunk) {
              // Append the chunk to the full response
              fullResponse += jsonResponse.chunk;
              setCurrentBotMessage(fullResponse);
              
              // Update the messages state with the current progress
              setMessages(messages => {
                const newMessages = [...messages];
                if (newMessages[newMessages.length - 1].sender === 'bot') {
                  newMessages[newMessages.length - 1].text = fullResponse;
                }
                return newMessages;
              });
            }
          } catch (e) {
            console.error("Error parsing JSON from stream:", e, "Line:", line);
          }
        }
      }
      
      // Return the full response after streaming is complete
      return { text: fullResponse, sessionId: currentSessionId };
      
    } catch (error) {
      console.error("Error in chat API call:", error);
      throw error;
    }
  };
  
  // Component to display animated typing effect for the current message being typed
  const TypingEffect = () => {
    return (
      <div className="typing-effect">
        {currentBotMessage}
        <span className="typing-cursor"></span>
      </div>
    )
  }

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    console.log("Toggle sidebar clicked. Current state:", sidebarOpen);
    setSidebarOpen(!sidebarOpen);
    console.log("New sidebar state will be:", !sidebarOpen);
  };

  // Create a new chat session
  const startNewChat = () => {
    createNewChat()
  };

  // Open map modal (for button in chat)
  const openMapModal = () => {
    setShowMapModal(true);
  };
  
  // Open time modal (for button in chat as fallback)
  const openTimeModal = () => {
    setShowTimeModal(true);
  };

  // Add this function to fetch all chats from MongoDB
  const fetchAllChats = async () => {
    try {
      setLoadingChats(true)
      const response = await axios.get(`${MONGO_API_URL}/chats`)
      if (response.data.success) {
        setChatList(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching chats:', error)
    } finally {
      setLoadingChats(false)
    }
  }

  // Add this function to select and load a chat
  const selectChat = async (chatId, chatTitle) => {
    if (chatId === currentChatId) return
    
    try {
      setIsLoading(true)
      
      // Save current chat ID for persistence
      setCurrentChatId(chatId)
      localStorage.setItem('currentChatId', chatId)
      
      // Update active chat for UI
      setActiveChat(chatTitle)
      
      // Fetch messages for this chat
      const response = await axios.get(`${MONGO_API_URL}/chats/${chatId}`)
      
      if (response.data.success) {
        // Update the messages state with the loaded messages
        setMessages(response.data.data.messages || [])
        console.log(`Loaded ${response.data.data.messages?.length || 0} messages for chat: ${chatTitle}`)
      }
    } catch (error) {
      console.error('Error loading chat:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Create a new chat
  const createNewChat = async () => {
    try {
      setIsLoading(true)
      const title = `Chat ${new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      })}`
      
      const response = await axios.post(`${MONGO_API_URL}/chats`, { title })
      
      if (response.data.success) {
        const newChat = response.data.data
        
        // Update chat list
        setChatList(prevChats => [newChat, ...prevChats])
        
        // Select the new chat
        selectChat(newChat.chatId, newChat.title)
        
        // Clear messages for the new chat
        setMessages([])
      }
    } catch (error) {
      console.error('Error creating new chat:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load chats on component mount
  useEffect(() => {
    fetchAllChats()
  }, [])

  return (
    <div className="chat-app">
      {/* Fixed sidebar toggle button */}
      <button className="fixed-sidebar-toggle" onClick={toggleSidebar}>
        {sidebarOpen ? '✕' : '☰'}
      </button>
      
      {/* Map Modal - for fallback */}
      <MapModal 
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        onSelectLocation={handleLocationSelected}
      />
      
      {/* Time Selector Modal - for fallback */}
      <TimeSelector
        isOpen={showTimeModal}
        onClose={() => setShowTimeModal(false)}
        onSelectTimeDay={handleTimeDaySelected}
      />
      
      {/* Sidebar Navigation */}
      <div className={`sidebar ${!sidebarOpen ? 'sidebar-hidden' : ''}`}>
        <div className="app-logo">
          <div className="logo-icon">
            <span className="logo-star">★</span>
          </div>
          <h1 className="app-title">QWB Chat Assistant</h1>
        </div>
        
        <button className="new-chat-btn" onClick={startNewChat}>NEW CHAT</button>
        
        <div className="chat-history">
          {loadingChats ? (
            <div className="chat-loading">Loading chats...</div>
          ) : chatList.length === 0 ? (
            <div className="no-chats">No chats yet. Start a new chat!</div>
          ) : (
            chatList.map(chat => (
              <div 
                key={chat.chatId} 
                className={`chat-item ${chat.chatId === currentChatId ? 'active' : ''}`} 
                onClick={() => selectChat(chat.chatId, chat.title)}
              >
                {chat.title}
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Main Content Wrapper */}
      <div className={`main-wrapper ${!sidebarOpen ? 'sidebar-hidden' : ''}`}>
        {/* Top Navbar */}
        <div className="navbar">
          <div className="navbar-logo">
            <div className="logo-circle">
              <span className="logo-star">★</span>
            </div>
            <h1 className="navbar-title">{activeChat || "QWB Chat Assistant"}</h1>
          </div>
          <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
        
        {/* Chat Content Area */}
        <div className="chat-content">
          <div className="messages-container" ref={messagesContainerRef}>
            <div className="messages-wrapper">
              {messages.map((message, index) => {
                // Special handling for the last bot message that's being typed
                const isLastBotMessage = 
                  message.sender === 'bot' && 
                  index === messages.length - 1 && 
                  isTyping;
                
                // Add location button if we're awaiting location
                const showLocationButton = 
                  message.sender === 'bot' && 
                  awaitingLocation && 
                  index === messages.length - 1 && 
                  !isTyping && 
                  !message.isEmbeddedMap;
                
                // Add time button if we're awaiting time/day (as fallback)
                const showTimeButton = 
                  message.sender === 'bot' && 
                  awaitingTimeDay && 
                  index === messages.length - 1 && 
                  !isTyping && 
                  !validatedTime && 
                  !validatedDay;
                
                // Determine if HTML content should be rendered
                const shouldRenderHTML = message.html && !isLastBotMessage;
                
                // Handle embedded map messages
                if (message.isEmbeddedMap) {
                  return (
                    <div 
                      key={message.id || index} 
                      className="message bot embedded-map-message"
                    >
                      <div className="map-intro-text">
                        Select a location by clicking on the map:
                      </div>
                      <MapModal 
                        embedded={true}
                        isOpen={true}
                        onClose={() => {}}
                        onSelectLocation={handleLocationSelected}
                      />
                    </div>
                  );
                }
                
                return (
                  <div 
                    key={message.id || index} 
                    className={`message ${message.sender} ${message.isLocationData || message.isTimeData ? 'location-data' : ''}`}
                  >
                    {isLastBotMessage ? (
                      <TypingEffect />
                    ) : shouldRenderHTML ? (
                      <div dangerouslySetInnerHTML={{ __html: message.text }} />
                    ) : (
                      message.text
                    )}
                    
                    {/* Location Selection Button - only show if not using embedded map */}
                    {showLocationButton && (
                      <button className="select-button" onClick={openMapModal}>
                        Select Location on Map
                      </button>
                    )}
                    
                    {/* Time Selection Button - only as fallback */}
                    {showTimeButton && (
                      <div className="time-day-helper">
                        <p className="helper-text">
                          Type the time and day in the message input, or use the selector:
                        </p>
                        <button className="select-button" onClick={openTimeModal}>
                          Open Time & Day Selector
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* If a bot message is being typed and not yet in messages, show it */}
              {isTyping && messages.length === 0 && <div className="message bot"><TypingEffect /></div>}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input Area */}
          <div className="input-wrapper">
            <form className="input-area" onSubmit={handleSendMessage}>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Message..."
                className="message-input"
                disabled={isLoading}
              />
              <button type="submit" className="send-button" disabled={isLoading}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App