// types/database.ts
export interface CardRecord {
  id: number;
  created_at: string;
  title: string;
  front_description: string;
  back_description: string;
  symbol: string;
  image_url?: string;
  tags?: string[];
  included_in_palestine_stack: boolean;
  is_featured: boolean;
  sources?: {
    text: string;
    url?: string;
  }[];
}

export interface UserInteraction {
  id: number;
  created_at: string;
  user_id?: string;
  card_id: number;
  interaction_type: 'view' | 'share' | 'feedback';
  feedback_rating?: number;
  feedback_text?: string;
}
