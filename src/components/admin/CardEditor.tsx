
import React, { useState } from 'react';
import { CardData } from '@/data/cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CardEditorProps {
  card: CardData;
  onSave: (updatedCard: CardData) => void;
  onCancel: () => void;
}

const CardEditor: React.FC<CardEditorProps> = ({ card, onSave, onCancel }) => {
  const [editedCard, setEditedCard] = useState<CardData>({ ...card });
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedCard(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation
    if (!editedCard.title.trim() || !editedCard.frontDescription.trim() || !editedCard.backDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }
    
    onSave(editedCard);
    toast({
      title: "Card Saved",
      description: "The card has been updated successfully",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 border border-border rounded-lg bg-card">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium">Edit Card</h3>
        <div className="flex space-x-2">
          <Button type="submit" size="sm" className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="id">ID</Label>
            <Input 
              id="id" 
              name="id" 
              value={editedCard.id} 
              onChange={handleChange}
              type="number"
              readOnly
              disabled
            />
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input 
              id="title" 
              name="title" 
              value={editedCard.title} 
              onChange={handleChange}
              placeholder="Card Title"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input 
              id="symbol" 
              name="symbol" 
              value={editedCard.symbol} 
              onChange={handleChange}
              placeholder="📚"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="frontDescription">Front Description (Myth)</Label>
          <Textarea 
            id="frontDescription" 
            name="frontDescription" 
            value={editedCard.frontDescription} 
            onChange={handleChange}
            placeholder="Description shown on the front of the card"
            rows={3}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="backDescription">Back Description (Truth)</Label>
          <Textarea 
            id="backDescription" 
            name="backDescription" 
            value={editedCard.backDescription} 
            onChange={handleChange}
            placeholder="Description shown on the back of the card"
            rows={6}
          />
        </div>
      </div>
    </form>
  );
};

export default CardEditor;
