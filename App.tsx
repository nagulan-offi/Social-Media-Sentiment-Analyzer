import React, { useState, useCallback, useEffect } from 'react';
import { analyzeSentiment } from './services/geminiService';
import type { AnalysisResult } from './types';
import ResultsDashboard from './components/ResultsDashboard';

const LoadingIndicator: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col justify-center items-center p-8 space-y-4">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-accent"></div>
    <p className="text-slate-400 text-lg animate-pulse">{message}</p>
  </div>
);

const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <div className="w-full max-w-3xl mx-auto mt-8 p-4 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-center">
    <p><strong>Error:</strong> {message}</p>
  </div>
);

const loadingMessages = [
  'Searching for recent posts...',
  'Analyzing sentiment...',
  'Consulting with social media experts...',
  'Compiling your report...',
  'Just a few more seconds...',
];

const App: React.FC = () => {
  const [topic, setTopic] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');

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
    <div className="min-h-screen bg-brand-secondary text-slate-200 font-sans flex flex-col items-center p-4">
      <header className="w-full text-center py-8 md:py-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
          AI-Powered Social Media Sentiment Analyzer
        </h1>
        <p className="mt-4 text-lg text-slate-400 max-w-3xl mx-auto">
          Enter any topic, brand, or hashtag to analyze recent public sentiment using Google Gemini. The analysis is based on a sample of up to 10 recent public posts.
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
              className="w-full p-4 pl-6 pr-32 text-lg text-white bg-brand-primary border-2 border-slate-700 rounded-full focus:ring-2 focus:ring-brand-accent focus:outline-none transition-all duration-300 disabled:opacity-50"
            />
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !topic.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-8 py-2.5 text-base font-semibold text-white bg-gradient-to-r from-brand-accent to-purple-600 rounded-full hover:from-brand-accent-hover hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-primary focus:ring-brand-accent-hover transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>

        {isLoading && <LoadingIndicator message={loadingMessage} />}
        {error && <ErrorMessage message={error} />}
        {results && <ResultsDashboard results={results} />}
        
        {!isLoading && !error && !results && (
            <div className="text-center mt-16 text-slate-500">
                <p>Enter a topic above to begin your analysis.</p>
            </div>
        )}
      </main>
      <footer className="w-full text-center py-6 mt-auto">
        <p className="text-sm text-slate-600">Powered by Google Gemini</p>
      </footer>
    </div>
  );
};

export default App;