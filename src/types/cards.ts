export interface CardData {
  id: number;
  title: string;
  frontDescription: string;
  backDescription: string;
  symbol: string;
  imageUrl?: string; // Made optional with ?
  sources: Array<{ text: string }>;
  includedInPalestineStack: boolean;
  isFeatured?: boolean;
  // Add any other properties that your cards might have
}
