
export interface SentimentSummary {
  total_posts: number;
  overall_sentiment: string;
  positive_percent: number;
  negative_percent: number;
  neutral_percent: number;
  overall_analysis: string;
}

export interface Post {
  post_content: string;
  author: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  reason: string;
}

export interface AnalysisResult {
  summary: SentimentSummary;
  posts: Post[];
}