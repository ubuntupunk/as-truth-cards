
import React from 'react';
import { CardData } from '@/data/cards';
import { Button } from '@/components/ui/button';
import { Search, Edit, Plus, Trash2, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface CardListProps {
  cards: CardData[];
  onEdit: (card: CardData) => void;
  onDelete: (cardId: number) => void;
  onAdd: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const CardList: React.FC<CardListProps> = ({ 
  cards, 
  onEdit, 
  onDelete, 
  onAdd, 
  searchQuery, 
  setSearchQuery 
}) => {
  // Filter cards based on search query
  const filteredCards = cards.filter(card => 
    card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.frontDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.backDescription.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search cards..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={onAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add New Card
        </Button>
      </div>

      {filteredCards.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "No cards match your search" : "No cards found"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCards.map((card) => (
            <div 
              key={card.id} 
              className={cn(
                "p-4 border border-border rounded-lg bg-card hover:bg-accent/10 transition-colors",
                card.isFeatured && "border-primary/50"
              )}
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">#{card.id}</Badge>
                    <h4 className="text-lg font-medium">{card.title}</h4>
                    <span className="text-xl">{card.symbol}</span>
                    {card.isFeatured && (
                      <Badge variant="secondary" className="ml-2">
                        <Star className="h-3 w-3 mr-1 text-amber-500" />
                        Featured
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {card.frontDescription}
                  </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onEdit(card)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => onDelete(card.id)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CardList;
