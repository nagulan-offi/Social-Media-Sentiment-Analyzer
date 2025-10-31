
import React, { useState, useCallback, useEffect } from 'react';
import { analyzeSentiment } from './services/geminiService';
import type { AnalysisResult } from './types';
import ResultsDashboard from './components/ResultsDashboard';

const LoadingIndicator: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col justify-center items-center p-8 space-y-4">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-accent"></div>
    <p className="text-gray-400 text-lg animate-pulse">{message}</p>
  </div>
);

interface ErrorDisplayProps {
  title: string;
  message: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ title, message, showRetry = false, onRetry }) => (
  <div className="w-full max-w-3xl mx-auto mt-8 p-6 bg-brand-negative/20 border border-brand-negative/40 text-red-200 rounded-lg text-center shadow-lg">
    <h3 className="text-xl font-bold text-red-200 mb-2">{title}</h3>
    <p className="text-red-200/90">{message}</p>
    {showRetry && onRetry && (
      <button
        onClick={onRetry}
        className="mt-6 px-6 py-2 text-base font-semibold text-white bg-brand-accent rounded-full hover:bg-brand-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-negative/20 focus:ring-brand-accent-hover transition-all duration-300"
      >
        Retry Analysis
      </button>
    )}
  </div>
);

const loadingMessages = [
  'Searching for recent posts...',
  'Analyzing sentiment...',
  'Consulting with social media experts...',
  'Compiling your report...',
  'Just a few more seconds...',
];

const getErrorDetails = (errorMessage: string): { title: string; message: string; showRetry: boolean } => {
    const lowerCaseError = errorMessage.toLowerCase();

    if (lowerCaseError.includes("api key")) {
        return {
            title: "API Key Error",
            message: "The provided API key is invalid or missing. Please ensure it's configured correctly.",
            showRetry: false,
        };
    }
    if (lowerCaseError.includes("request was blocked") || lowerCaseError.includes("safety policies")) {
        return {
            title: "Content Policy Violation",
            message: "The analysis was blocked because the topic may violate content safety policies. Please try a different topic.",
            showRetry: false,
        };
    }
    if (lowerCaseError.includes("plagiarism") || lowerCaseError.includes("recitation")) {
        return {
            title: "Analysis Blocked",
            message: "The analysis was stopped to avoid plagiarism, which can happen if search results are too repetitive. Please try a broader or different topic.",
            showRetry: false,
        };
    }
    if (lowerCaseError.includes("response was too long") || lowerCaseError.includes("token limit")) {
        return {
            title: "Topic Too Broad",
            message: "The query generated too much data to process. Please try again with a more specific topic.",
            showRetry: true,
        };
    }
    if (lowerCaseError.includes("empty response")) {
        return {
            title: "No Results Found",
            message: "No relevant public posts could be found for this topic. Please try rephrasing your query.",
            showRetry: false,
        };
    }
    if (lowerCaseError.includes("max retries reached") || lowerCaseError.includes("temporarily unavailable") || lowerCaseError.includes("service is temporarily unavailable")) {
        return {
            title: "Service Unavailable",
            message: "The analysis service is currently busy or couldn't be reached. This is likely a temporary issue.",
            showRetry: true,
        };
    }
     if (lowerCaseError.includes("malformed") || lowerCaseError.includes("not in the expected format") || lowerCaseError.includes("incomplete")) {
        return {
            title: "AI Response Error",
            message: "The AI returned data in an unexpected format. This can be a temporary issue. Retrying or rephrasing your topic might help.",
            showRetry: true,
        };
    }
    // Default for network errors or other transient issues.
    return {
        title: "An Unexpected Error Occurred",
        message: "Something went wrong during the analysis. This might be a temporary network issue.",
        showRetry: true,
    };
};


const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [sentimentFilter, setSentimentFilter] = useState<'Positive' | 'Negative' | 'Neutral' | 'All'>('All');

  useEffect(() => {
    let interval: number | undefined;
    if (isLoading) {
      let messageIndex = 0;
      setLoadingMessage(loadingMessages[0]);
      interval = window.setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 3000); // Change message every 3 seconds
    }
    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [isLoading]);

  const handleAnalyze = useCallback(async () => {
    if (!topic.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResults(null);
    setSentimentFilter('All'); // Reset filter on new analysis

    try {
      const analysisData = await analyzeSentiment(topic);
      setResults(analysisData);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [topic, isLoading]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-screen bg-brand-secondary text-gray-200 font-sans flex flex-col items-center p-4">
      <header className="w-full text-center py-8 md:py-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">
          AI-Powered Social Media Sentiment Analyzer
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto">
          Enter any topic, brand, or hashtag to analyze recent public sentiment. Clear and specific topics yield the best results.
        </p>
      </header>
      
      <main className="w-full flex-grow flex flex-col items-center">
        <div className="w-full max-w-3xl mx-auto p-4 sticky top-4 z-10 bg-brand-secondary/80 backdrop-blur-sm rounded-xl">
          <div className="relative flex items-center">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., 'new electric cars' or '#TechConference2024'"
              disabled={isLoading}
              className="w-full p-4 pl-6 pr-32 text-lg text-white bg-brand-primary border-2 border-blue-900/50 rounded-full focus:ring-2 focus:ring-brand-accent focus:outline-none transition-all duration-300 disabled:opacity-50"
            />
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !topic.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-8 py-2.5 text-base font-semibold text-white bg-gradient-to-r from-brand-accent to-orange-600 rounded-full hover:from-brand-accent-hover hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-primary focus:ring-brand-accent-hover transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        {isLoading && <LoadingIndicator message={loadingMessage} />}
        
        {error && (() => {
            const { title, message, showRetry } = getErrorDetails(error);
            return (
                <ErrorDisplay
                    title={title}
                    message={message}
                    showRetry={showRetry}
                    onRetry={handleAnalyze}
                />
            );
        })()}

        {results && (
            <ResultsDashboard 
                results={results} 
                sentimentFilter={sentimentFilter}
                setSentimentFilter={setSentimentFilter}
            />
        )}
        
        {!isLoading && !error && !results && (
            <div className="text-center mt-16 text-gray-500">
                <p>Enter a topic above to begin your analysis.</p>
            </div>
        )}
      </main>
      <footer className="w-full text-center py-6 mt-auto">
        <p className="text-sm text-gray-500">Powered by Google's Gemini API</p>
      </footer>
    </div>
  );
};

export default App;