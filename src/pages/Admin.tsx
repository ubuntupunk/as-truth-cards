
import React, { useState } from 'react';
import { cards as initialCards, CardData } from '@/data/cards';
import CardList from '@/components/admin/CardList';
import CardEditor from '@/components/admin/CardEditor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Info, Save, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Admin = () => {
  const [cards, setCards] = useState<CardData[]>(initialCards);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { toast } = useToast();

  const handleEdit = (card: CardData) => {
    setEditingCard(card);
  };

  const handleAddNew = () => {
    const newId = Math.max(0, ...cards.map(c => c.id)) + 1;
    setEditingCard({
      id: newId,
      title: 'New Card',
      frontDescription: '',
      backDescription: '',
      symbol: '🔄'
    });
  };

  const handleSave = (updatedCard: CardData) => {
    // Check if it's a new card or an update
    if (cards.some(card => card.id === updatedCard.id)) {
      setCards(cards.map(card => 
        card.id === updatedCard.id ? updatedCard : card
      ));
    } else {
      setCards([...cards, updatedCard]);
    }
    setEditingCard(null);
  };

  const handleDelete = (cardId: number) => {
    // In a real app, you might want to show a confirmation dialog
    setCards(cards.filter(card => card.id !== cardId));
    toast({
      title: "Card Deleted",
      description: "The card has been removed",
    });
  };

  const handleExport = () => {
    const dataStr = `export interface CardData {
  id: number;
  title: string;
  frontDescription: string;
  backDescription: string;
  symbol: string;
}

export const cards: CardData[] = ${JSON.stringify(cards, null, 2)};
`;

    // Display the data for copying
    setShowExportDialog(true);
    
    // In a real application, you might want to save this to a file
    // or send it to an API endpoint
    toast({
      title: "Export Ready",
      description: "Copy the code below to update your data file",
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow pt-24 pb-16 px-4 md:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
            <p className="text-muted-foreground">
              Manage the Truth Cards content from this panel.
            </p>
          </div>
          
          {showExportDialog ? (
            <div className="mb-8 space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Export Data</AlertTitle>
                <AlertDescription>
                  Copy the code below and replace the contents of <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">src/data/cards.ts</code>
                </AlertDescription>
              </Alert>
              
              <div className="relative">
                <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                  {`export interface CardData {
  id: number;
  title: string;
  frontDescription: string;
  backDescription: string;
  symbol: string;
}

export const cards: CardData[] = ${JSON.stringify(cards, null, 2)};`}
                </pre>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowExportDialog(false)}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-8 flex justify-end">
              <Button 
                onClick={handleExport}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Export Changes
              </Button>
            </div>
          )}
          
          {editingCard ? (
            <CardEditor 
              card={editingCard} 
              onSave={handleSave} 
              onCancel={() => setEditingCard(null)} 
            />
          ) : (
            <CardList 
              cards={cards}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAddNew}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Admin;
