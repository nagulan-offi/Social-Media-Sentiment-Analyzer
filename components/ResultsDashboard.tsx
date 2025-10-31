

import React from 'react';
import type { AnalysisResult, Post, SentimentSummary } from '../types';
import SentimentChart from './SentimentChart';

const getSentimentClasses = (sentiment: Post['sentiment']) => {
  switch (sentiment) {
    case 'Positive':
      return 'bg-[#CBD99B]/10 text-[#CBD99B] border-[#CBD99B]/20';
    case 'Negative':
      return 'bg-[#E53935]/10 text-[#E53935] border-[#E53935]/20';
    case 'Neutral':
      return 'bg-[#A0AEC0]/10 text-[#A0AEC0] border-[#A0AEC0]/20';
    default:
      return 'bg-gray-700 text-gray-300 border-gray-600';
  }
};

const PostCard: React.FC<{ post: Post }> = ({ post }) => (
  <div className="bg-brand-primary/60 border border-blue-800/50 rounded-lg p-4 space-y-3 transition-all hover:bg-brand-primary/90 hover:border-blue-700">
    <div className="flex justify-between items-start">
      <p className="text-gray-400 text-sm font-medium">{post.author}</p>
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getSentimentClasses(post.sentiment)}`}>
        {post.sentiment}
      </span>
    </div>
    <p className="text-gray-300">{post.post_content}</p>
    <p className="text-xs text-gray-500 italic border-l-2 border-blue-800 pl-2">
      <strong>Reason:</strong> {post.reason}
    </p>
  </div>
);

const SentimentStat: React.FC<{ label: string; value: string | number; className?: string; onClick?: () => void; isActive?: boolean }> = ({ label, value, className = '', onClick, isActive = false }) => (
  <button 
    onClick={onClick} 
    disabled={!onClick}
    className={`w-full flex justify-between items-baseline p-3 bg-white/5 rounded-md transition-colors duration-200 ${onClick ? 'cursor-pointer hover:bg-white/10' : 'cursor-default'} ${isActive ? 'ring-2 ring-brand-accent' : ''}`}
  >
    <span className="text-gray-400 text-sm">{label}</span>
    <span className={`font-bold text-lg ${className}`}>{value}</span>
  </button>
);

const SentimentSummaryCard: React.FC<{ 
    summary: SentimentSummary, 
    onFilterChange: (filter: 'Positive' | 'Negative' | 'Neutral' | 'All') => void;
    activeFilter: 'Positive' | 'Negative' | 'Neutral' | 'All';
}> = ({ summary, onFilterChange, activeFilter }) => {
    const { 
        total_posts = 0, 
        overall_sentiment = 'Neutral', 
        positive_percent = 0, 
        negative_percent = 0, 
        neutral_percent = 0 
    } = summary || {};

    const getSentimentColor = (sentiment: string) => {
        if (sentiment.toLowerCase() === 'positive') return 'text-brand-positive';
        if (sentiment.toLowerCase() === 'negative') return 'text-brand-negative';
        return 'text-brand-neutral';
    }
    
    return (
    <div className="bg-brand-primary p-6 rounded-xl shadow-lg h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6">Sentiment Breakdown</h2>
      <div className="space-y-3 mb-6">
        <SentimentStat label="Total Posts Analyzed" value={total_posts} className="text-gray-200"/>
        <SentimentStat label="Overall Sentiment" value={overall_sentiment} className={getSentimentColor(overall_sentiment)}/>
        <SentimentStat 
            label="Positive Posts" 
            value={`${positive_percent.toFixed(0)}%`} 
            className="text-brand-positive"
            onClick={() => onFilterChange('Positive')}
            isActive={activeFilter === 'Positive'}
        />
        <SentimentStat 
            label="Negative Posts" 
            value={`${negative_percent.toFixed(0)}%`} 
            className="text-brand-negative"
            onClick={() => onFilterChange('Negative')}
            isActive={activeFilter === 'Negative'}
        />
        <SentimentStat 
            label="Neutral Posts" 
            value={`${neutral_percent.toFixed(0)}%`} 
            className="text-brand-neutral"
            onClick={() => onFilterChange('Neutral')}
            isActive={activeFilter === 'Neutral'}
        />
        {activeFilter !== 'All' && (
             <button onClick={() => onFilterChange('All')} className="w-full text-center text-sm p-2 text-brand-accent hover:underline">
                Show All Posts
             </button>
        )}
      </div>
      <div className="flex-grow flex items-center justify-center">
        <SentimentChart data={{ total_posts, overall_sentiment, positive_percent, negative_percent, neutral_percent }} />
      </div>
    </div>
    );
}

const WordCloudCard: React.FC<{ posts: Post[] }> = ({ posts }) => {
    // Fix: TypeScript can infer the return type of useMemo as `never[]` if it only returns an empty array, which can lead to type issues.
    // By explicitly typing the `wordCloud` variable, we ensure it is always correctly typed as `{ word: string; size: number }[]`.
    const wordCloud: { word: string; size: number }[] = React.useMemo(() => {
        const stopWords = new Set(['a', 'an', 'the', 'is', 'in', 'it', 'of', 'and', 'for', 'to', 'on', 'with', 'was', 'i', 'that', 'this', 'be', 'are', 'has', 'have', 'at', 'by', 'as']);
        const wordCounts: { [key: string]: number } = {};

        posts.forEach(post => {
            const words = post.post_content.toLowerCase().match(/\b(\w+)\b/g) || [];
            words.forEach(word => {
                if (word.length > 2 && !stopWords.has(word) && !/\d/.test(word)) {
                    wordCounts[word] = (wordCounts[word] || 0) + 1;
                }
            });
        });

        const sortedWords = Object.entries(wordCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20); // Get top 20 words

        if (sortedWords.length === 0) return [];

        const maxCount = sortedWords[0][1];
        const minCount = sortedWords[sortedWords.length - 1][1];

        return sortedWords.map(([word, count]) => {
            const size = 1 + ((count - minCount) / (maxCount - minCount + 1)) * 2; // Normalize size from 1rem to 3rem
            return { word, size: Math.max(1, size) }; // Ensure minimum size
        });
    }, [posts]);

    if (wordCloud.length === 0) {
        return null;
    }

    return (
        <div className="bg-brand-primary p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Key Terms</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center items-center">
                {wordCloud.map(({ word, size }) => (
                    <span 
                        key={word}
                        className="text-gray-400 transition-colors hover:text-brand-accent"
                        style={{ fontSize: `${size}rem`, lineHeight: `${size * 1.1}rem` }}
                    >
                        {word}
                    </span>
                ))}
            </div>
        </div>
    );
};


const PostsFeed: React.FC<{ posts: Post[], filter: string }> = ({ posts, filter }) => (
  <div className="bg-brand-primary p-6 rounded-xl shadow-lg h-full">
    <h2 className="text-2xl font-bold text-white mb-6">
      {filter === 'All' ? 'Recent Posts' : `Recent ${filter} Posts`}
    </h2>
    {posts.length > 0 ? (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {posts.map((post, index) => (
            <PostCard key={index} post={post} />
        ))}
        </div>
    ) : (
        <div className="flex items-center justify-center h-48">
            <p className="text-gray-500">No {filter !== 'All' ? filter : ''} posts found.</p>
        </div>
    )}
  </div>
);

interface ResultsDashboardProps {
    results: AnalysisResult;
    sentimentFilter: 'Positive' | 'Negative' | 'Neutral' | 'All';
    setSentimentFilter: (filter: 'Positive' | 'Negative' | 'Neutral' | 'All') => void;
}

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ results, sentimentFilter, setSentimentFilter }) => {
    const filteredPosts = results.posts.filter(post => 
        sentimentFilter === 'All' || post.sentiment === sentimentFilter
    );

    return (
      <section id="results" className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1 space-y-8">
            <SentimentSummaryCard 
                summary={results.summary} 
                onFilterChange={setSentimentFilter}
                activeFilter={sentimentFilter}
            />
            <WordCloudCard posts={results.posts} />
          </div>
          <div className="lg:col-span-2">
            <PostsFeed posts={filteredPosts} filter={sentimentFilter} />
          </div>
        </div>
      </section>
    );
};

export default ResultsDashboard;
