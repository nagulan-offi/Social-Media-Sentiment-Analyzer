
import React from 'react';
import type { AnalysisResult, Post, SentimentSummary } from '../types';
import SentimentChart from './SentimentChart';

const getSentimentClasses = (sentiment: Post['sentiment']) => {
  switch (sentiment) {
    case 'Positive':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Negative':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'Neutral':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-700 text-gray-300 border-gray-600';
  }
};

const PostCard: React.FC<{ post: Post }> = ({ post }) => (
  <div className="bg-brand-primary/50 border border-slate-700/50 rounded-lg p-4 space-y-3 transition-all hover:bg-brand-primary/80 hover:border-slate-600">
    <div className="flex justify-between items-start">
      <p className="text-slate-400 text-sm font-medium">{post.author}</p>
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getSentimentClasses(post.sentiment)}`}>
        {post.sentiment}
      </span>
    </div>
    <p className="text-slate-300">{post.post_content}</p>
    <p className="text-xs text-slate-500 italic border-l-2 border-slate-600 pl-2">
      <strong>Reason:</strong> {post.reason}
    </p>
  </div>
);

const SentimentStat: React.FC<{ label: string; value: string | number; className?: string }> = ({ label, value, className = '' }) => (
  <div className="flex justify-between items-baseline p-3 bg-slate-800/50 rounded-md">
    <span className="text-slate-400 text-sm">{label}</span>
    <span className={`font-bold text-lg ${className}`}>{value}</span>
  </div>
);

const SentimentSummaryCard: React.FC<{ summary: SentimentSummary }> = ({ summary }) => {
    const getSentimentColor = (sentiment: string) => {
        if (sentiment.toLowerCase() === 'positive') return 'text-green-400';
        if (sentiment.toLowerCase() === 'negative') return 'text-red-400';
        return 'text-gray-400';
    }
    
    return (
    <div className="bg-brand-primary p-6 rounded-xl shadow-lg h-full flex flex-col">
      <h2 className="text-2xl font-bold text-slate-100 mb-6">Sentiment Breakdown</h2>
      <div className="space-y-3 mb-6">
        <SentimentStat label="Total Posts Analyzed" value={summary.total_posts} className="text-slate-200"/>
        <SentimentStat label="Overall Sentiment" value={summary.overall_sentiment} className={getSentimentColor(summary.overall_sentiment)}/>
      </div>
      <div className="flex-grow flex items-center justify-center">
        <SentimentChart data={summary} />
      </div>
    </div>
    );
}

const PostsFeed: React.FC<{ posts: Post[] }> = ({ posts }) => (
  <div className="bg-brand-primary p-6 rounded-xl shadow-lg h-full">
    <h2 className="text-2xl font-bold text-slate-100 mb-6">Recent Posts</h2>
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {posts.map((post, index) => (
        <PostCard key={index} post={post} />
      ))}
    </div>
  </div>
);

const ResultsDashboard: React.FC<{ results: AnalysisResult }> = ({ results }) => (
  <section id="results" className="w-full max-w-7xl mx-auto px-4 py-8">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1">
        <SentimentSummaryCard summary={results.summary} />
      </div>
      <div className="lg:col-span-2">
        <PostsFeed posts={results.posts} />
      </div>
    </div>
  </section>
);

export default ResultsDashboard;
