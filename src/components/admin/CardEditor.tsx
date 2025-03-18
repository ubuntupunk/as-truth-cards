
import React, { useState } from 'react';
import { CardData } from '@/data/cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CardEditorProps {
  card: CardData;
  onSave: (updatedCard: CardData) => void;
  onCancel: () => void;
}

const CardEditor: React.FC<CardEditorProps> = ({ card, onSave, onCancel }) => {
  const [editedCard, setEditedCard] = useState<CardData>({ 
    ...card, 
    sources: card.sources || [] 
  });
  const [newSource, setNewSource] = useState('');
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

  const addSource = () => {
    if (newSource.trim()) {
      setEditedCard(prev => ({
        ...prev,
        sources: [...(prev.sources || []), newSource.trim()]
      }));
      setNewSource('');
    }
  };

  const removeSource = (index: number) => {
    setEditedCard(prev => ({
      ...prev,
      sources: prev.sources?.filter((_, i) => i !== index) || []
    }));
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
        
        <div className="space-y-2">
          <Label>Sources</Label>
          
          <div className="space-y-2">
            {editedCard.sources?.map((source, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input 
                  value={source}
                  onChange={(e) => {
                    const newSources = [...(editedCard.sources || [])];
                    newSources[index] = e.target.value;
                    setEditedCard(prev => ({
                      ...prev,
                      sources: newSources
                    }));
                  }}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="icon" 
                  onClick={() => removeSource(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <Input 
              placeholder="Add a source citation"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSource();
                }
              }}
            />
            <Button 
              type="button" 
              onClick={addSource}
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default CardEditor;
