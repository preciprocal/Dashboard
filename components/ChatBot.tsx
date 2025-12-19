// "use client";

// import React, { useState, useRef, useEffect, useCallback } from "react";
// import { usePathname } from "next/navigation";
// import {
//   Send,
//   X,
//   MessageCircle,
//   Bot,
//   User,
//   Minimize2,
//   Maximize2,
//   RefreshCw,
//   ThumbsUp,
//   ThumbsDown,
//   Copy,
//   HelpCircle,
// } from "lucide-react";
// import {
//   findBestMatch,
//   getCategorySuggestions,
//   getRandomFallbackResponse,
//   getRelatedQuestions,
//   type ChatbotQA,
// } from "@/app/data/chatbotKnowledge";

// interface Message {
//   id: number;
//   type: "bot" | "user";
//   message: string;
//   timestamp: Date;
//   suggestions?: string[];
//   relatedQuestions?: string[];
//   category?: string;
// }

// const ChatBot = () => {
//   const pathname = usePathname();

//   // ✅ ALL HOOKS MOVED TO THE TOP - BEFORE ANY CONDITIONAL LOGIC
//   const [isOpen, setIsOpen] = useState(false);
//   const [isMinimized, setIsMinimized] = useState(false);
//   const [messages, setMessages] = useState<Message[]>([
//     {
//       id: 1,
//       type: "bot",
//       message:
//         "Hello! I'm Alex, your AI assistant for Preciprocal AI. I can help you with pricing, features, technical support, and getting started. How can I assist you today?",
//       timestamp: new Date(),
//       suggestions: [
//         "Pricing plans",
//         "How it works",
//         "Success stories",
//         "Get started",
//       ],
//       category: "general",
//     },
//   ]);
//   const [inputValue, setInputValue] = useState("");
//   const [isTyping, setIsTyping] = useState(false);
//   const [showFeedback, setShowFeedback] = useState<{
//     messageId: number;
//     type: string;
//   } | null>(null);
//   const [conversationContext, setConversationContext] = useState<string[]>([]);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLInputElement>(null);
//   const chatbotRef = useRef<HTMLDivElement>(null);

//   // ✅ MOVE FUNCTION DECLARATIONS BEFORE useEffect CALLS
//   const scrollToBottom = useCallback(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, []);

//   const findBestResponse = useCallback((
//     userInput: string
//   ): { answer: string; category: string; matchedItem?: ChatbotQA } => {
//     // Update conversation context
//     const newContext = [...conversationContext, userInput.toLowerCase()].slice(
//       -3
//     );
//     setConversationContext(newContext);

//     // Try to find a match in the knowledge base
//     const match = findBestMatch(userInput);

//     if (match) {
//       return {
//         answer: match.answer,
//         category: match.category,
//         matchedItem: match,
//       };
//     }

//     // Return fallback response if no match found
//     return {
//       answer: getRandomFallbackResponse(),
//       category: "general",
//     };
//   }, [conversationContext]);

//   const handleSendMessage = useCallback(async () => {
//     if (!inputValue.trim()) return;

//     const userMessage: Message = {
//       id: Date.now(),
//       type: "user",
//       message: inputValue,
//       timestamp: new Date(),
//     };

//     setMessages((prev) => [...prev, userMessage]);
//     const currentInput = inputValue;
//     setInputValue("");
//     setIsTyping(true);

//     // Simulate realistic typing delay
//     const typingDelay = Math.min(Math.max(currentInput.length * 30, 800), 2000);

//     setTimeout(() => {
//       const { answer, category, matchedItem } = findBestResponse(currentInput);

//       // Generate suggestions based on category and context
//       let suggestions = getCategorySuggestions(category);
//       let relatedQuestions: string[] = [];

//       if (matchedItem) {
//         relatedQuestions = getRelatedQuestions(matchedItem);
//         suggestions = [
//           ...relatedQuestions.slice(0, 2),
//           ...suggestions.slice(0, 2),
//         ];
//       }

//       const botMessage: Message = {
//         id: Date.now() + 1,
//         type: "bot",
//         message: answer,
//         timestamp: new Date(),
//         suggestions: suggestions.slice(0, 3), // Limit to 3 suggestions
//         relatedQuestions,
//         category,
//       };

//       setMessages((prev) => [...prev, botMessage]);
//       setIsTyping(false);
//     }, typingDelay);
//   }, [inputValue, findBestResponse]);

//   const handleSuggestionClick = useCallback((suggestion: string) => {
//     setInputValue(suggestion);
//     setTimeout(() => {
//       handleSendMessage();
//     }, 100);
//   }, [handleSendMessage]);

//   const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       handleSendMessage();
//     }
//   }, [handleSendMessage]);

//   const handleFeedback = useCallback((messageId: number, type: string) => {
//     setShowFeedback({ messageId, type });
//     console.log(`Feedback for message ${messageId}: ${type}`);
//     setTimeout(() => setShowFeedback(null), 2000);
//   }, []);

//   const copyToClipboard = useCallback(async (text: string) => {
//     try {
//       await navigator.clipboard.writeText(text);
//     } catch (err) {
//       console.error("Failed to copy text: ", err);
//     }
//   }, []);

//   const clearChat = useCallback(() => {
//     setMessages([
//       {
//         id: 1,
//         type: "bot",
//         message:
//           "Chat cleared. I'm here to help with any questions about Preciprocal AI. What would you like to know?",
//         timestamp: new Date(),
//         suggestions: [
//           "Pricing plans",
//           "How it works",
//           "Success stories",
//           "Get started",
//         ],
//         category: "general",
//       },
//     ]);
//     setConversationContext([]);
//   }, []);

//   const handleContactSupport = useCallback(() => {
//     window.open("mailto:support@preciprocal.ai", "_blank");
//   }, []);

//   const handleStartTrial = useCallback(() => {
//     window.open("/createinterview", "_blank");
//   }, []);

//   // Pages where chatbot should be hidden
//   const hiddenPages = [
//     "/interview",
//     "/createinterview",
//     "/live-interview",
//     "/ai-interview",
//     "/mock-interview",
//     "/practice-interview",
//     "/interview-session",
//     "/dashboard/interview",
//     "/profile/interview",
//   ];

//   // Check if current page should hide chatbot
//   const shouldHideChatbot = hiddenPages.some(
//     (page) => pathname.startsWith(page) || pathname.includes("/interview")
//   );

//   // ✅ NOW useEffect CALLS CAN SAFELY USE THE FUNCTIONS
//   // Handle click outside to close chatbot
//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (
//         chatbotRef.current &&
//         !chatbotRef.current.contains(event.target as Node)
//       ) {
//         setIsOpen(false);
//       }
//     };

//     // Add event listener when chatbot is open
//     if (isOpen) {
//       document.addEventListener("mousedown", handleClickOutside);
//     }

//     // Cleanup event listener
//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//     };
//   }, [isOpen]);

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages, scrollToBottom]);

//   useEffect(() => {
//     if (isOpen && inputRef.current) {
//       inputRef.current.focus();
//     }
//   }, [isOpen]);

//   // ✅ CONDITIONAL RETURN MOVED AFTER ALL HOOKS AND FUNCTION DECLARATIONS
//   if (shouldHideChatbot) {
//     return null;
//   }

//   if (!isOpen) {
//     return (
//       <div
//         className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50"
//         ref={chatbotRef}
//       >
//         <button
//           onClick={() => setIsOpen(true)}
//           className="group relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white rounded-full p-3 sm:p-4 shadow-lg transition-all duration-200 hover:shadow-xl"
//           aria-label="Open chat support"
//         >
//           <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />

//           {/* Tooltip - hidden on mobile */}
//           <div className="hidden sm:block absolute bottom-full right-0 mb-3 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg pointer-events-none">
//             Need help? Chat with Alex
//             <div className="absolute top-full right-4 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
//           </div>
//         </button>
//       </div>
//     );
//   }

//   return (
//     <div
//       ref={chatbotRef}
//       className={`fixed transition-all duration-300 z-50
//         ${
//           // Mobile: Full screen on small devices
//           isMinimized
//             ? "bottom-4 right-4 sm:bottom-6 sm:right-6 h-16 w-80 sm:w-96"
//             : "inset-x-4 bottom-4 top-4 sm:bottom-6 sm:right-6 sm:top-auto sm:left-auto sm:h-[600px] sm:w-96"
//         }`}
//     >
//       <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden h-full flex flex-col backdrop-blur-sm">
//         {/* Header */}
//         <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-3 sm:p-4 flex items-center justify-between">
//           <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
//             <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
//               <Bot className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
//             </div>
//             <div className="min-w-0">
//               <h3 className="text-white font-semibold text-sm">
//                 Alex - AI Assistant
//               </h3>
//               <div className="flex items-center space-x-1">
//                 <div className="w-2 h-2 bg-green-400 rounded-full"></div>
//                 <span className="text-white/90 text-xs truncate">
//                   Online • Ready to help
//                 </span>
//               </div>
//             </div>
//           </div>

//           <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
//             {/* Hide minimize button on mobile when open */}
//             <button
//               onClick={() => setIsMinimized(!isMinimized)}
//               className="hidden sm:block text-white/80 hover:text-white transition-colors p-1 rounded"
//               aria-label={isMinimized ? "Maximize chat" : "Minimize chat"}
//             >
//               {isMinimized ? (
//                 <Maximize2 className="h-4 w-4" />
//               ) : (
//                 <Minimize2 className="h-4 w-4" />
//               )}
//             </button>
//             <button
//               onClick={clearChat}
//               className="text-white/80 hover:text-white transition-colors p-1 rounded"
//               title="Clear chat"
//             >
//               <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
//             </button>
//             <button
//               onClick={() => setIsOpen(false)}
//               className="text-white/80 hover:text-white transition-colors p-1 rounded"
//               aria-label="Close chat"
//             >
//               <X className="h-3 w-3 sm:h-4 sm:w-4" />
//             </button>
//           </div>
//         </div>

//         {!isMinimized && (
//           <>
//             {/* Quick Actions */}
//             <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-700/50 bg-gray-800/30">
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
//                 <button
//                   onClick={handleStartTrial}
//                   className="flex items-center justify-center p-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-lg transition-colors text-xs font-medium text-blue-300"
//                 >
//                   Start Free Trial
//                 </button>
//                 <button
//                   onClick={handleContactSupport}
//                   className="flex items-center justify-center p-2 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 rounded-lg transition-colors text-xs font-medium text-purple-300"
//                 >
//                   <HelpCircle className="h-3 w-3 mr-1" />
//                   Contact Support
//                 </button>
//               </div>
//             </div>

//             {/* Messages */}
//             <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
//               {messages.map((message) => (
//                 <div
//                   key={message.id}
//                   className={`flex ${
//                     message.type === "user" ? "justify-end" : "justify-start"
//                   }`}
//                 >
//                   <div
//                     className={`max-w-[90%] sm:max-w-[85%] ${
//                       message.type === "user" ? "order-2" : "order-1"
//                     }`}
//                   >
//                     <div className="flex items-start space-x-2">
//                       {message.type === "bot" && (
//                         <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
//                           <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
//                         </div>
//                       )}

//                       <div
//                         className={`rounded-lg px-3 py-2 ${
//                           message.type === "user"
//                             ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
//                             : "bg-gray-800/60 text-gray-100 border border-gray-700/50"
//                         }`}
//                       >
//                         <div className="text-sm leading-relaxed whitespace-pre-wrap">
//                           {message.message}
//                         </div>

//                         {message.type === "bot" && (
//                           <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
//                             <div className="flex items-center space-x-1">
//                               <button
//                                 onClick={() => handleFeedback(message.id, "up")}
//                                 className={`p-1 rounded transition-colors ${
//                                   showFeedback?.messageId === message.id &&
//                                   showFeedback?.type === "up"
//                                     ? "text-green-400 bg-green-400/10"
//                                     : "text-gray-400 hover:text-green-400"
//                                 }`}
//                                 title="Helpful"
//                               >
//                                 <ThumbsUp className="h-3 w-3" />
//                               </button>
//                               <button
//                                 onClick={() =>
//                                   handleFeedback(message.id, "down")
//                                 }
//                                 className={`p-1 rounded transition-colors ${
//                                   showFeedback?.messageId === message.id &&
//                                   showFeedback?.type === "down"
//                                     ? "text-red-400 bg-red-400/10"
//                                     : "text-gray-400 hover:text-red-400"
//                                 }`}
//                                 title="Not helpful"
//                               >
//                                 <ThumbsDown className="h-3 w-3" />
//                               </button>
//                             </div>
//                             <button
//                               onClick={() => copyToClipboard(message.message)}
//                               className="text-gray-400 hover:text-gray-300 p-1 rounded transition-colors"
//                               title="Copy"
//                             >
//                               <Copy className="h-3 w-3" />
//                             </button>
//                           </div>
//                         )}
//                       </div>

//                       {message.type === "user" && (
//                         <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
//                           <User className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
//                         </div>
//                       )}
//                     </div>

//                     {/* Suggestions */}
//                     {message.suggestions && message.suggestions.length > 0 && (
//                       <div className="mt-2 flex flex-wrap gap-1 ml-8 sm:ml-9">
//                         {message.suggestions.map((suggestion, index) => (
//                           <button
//                             key={index}
//                             onClick={() => handleSuggestionClick(suggestion)}
//                             className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-md transition-colors border border-blue-200"
//                           >
//                             {suggestion}
//                           </button>
//                         ))}
//                       </div>
//                     )}

//                     <div className="text-xs text-gray-500 mt-1 ml-8 sm:ml-9">
//                       {message.timestamp.toLocaleTimeString([], {
//                         hour: "2-digit",
//                         minute: "2-digit",
//                       })}
//                     </div>
//                   </div>
//                 </div>
//               ))}

//               {isTyping && (
//                 <div className="flex justify-start">
//                   <div className="flex items-start space-x-2">
//                     <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mt-1">
//                       <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
//                     </div>
//                     <div className="bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/50">
//                       <div className="flex space-x-1">
//                         <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
//                         <div
//                           className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
//                           style={{ animationDelay: "0.1s" }}
//                         ></div>
//                         <div
//                           className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
//                           style={{ animationDelay: "0.2s" }}
//                         ></div>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               )}

//               <div ref={messagesEndRef} />
//             </div>

//             {/* Input */}
//             <div className="p-3 sm:p-4 border-t border-gray-700/50 bg-gray-800/30">
//               <div className="flex space-x-2">
//                 <input
//                   ref={inputRef}
//                   type="text"
//                   value={inputValue}
//                   onChange={(e) => setInputValue(e.target.value)}
//                   onKeyPress={handleKeyPress}
//                   placeholder="Ask about pricing, features, or support..."
//                   className="flex-1 bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-gray-700 transition-colors text-sm"
//                   disabled={isTyping}
//                 />
//                 <button
//                   onClick={handleSendMessage}
//                   disabled={!inputValue.trim() || isTyping}
//                   className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 min-w-[40px] sm:min-w-[44px] flex items-center justify-center"
//                   aria-label="Send message"
//                 >
//                   <Send className="h-4 w-4" />
//                 </button>
//               </div>

//               {/* Footer */}
//               <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
//                 <div className="flex items-center space-x-1">
//                   <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
//                   <span>Secure & Private</span>
//                 </div>
//                 <span>{messages.length - 1} messages</span>
//               </div>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ChatBot;