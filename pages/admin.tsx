
import React, { useState, useEffect } from 'react';
import { CardData } from '../src/types/cards';
import CardList from '../src/components/admin/CardList';
import CardEditor from '../src/components/admin/CardEditor';
import { Alert, AlertDescription, AlertTitle } from '../src/components/ui/alert';
import { Button } from '../src/components/ui/button';
import { useToast } from '../src/hooks/use-toast';
import { Info, Save, X } from 'lucide-react';
import Header from '../src/components/Header';
import Footer from '../src/components/Footer';

const Admin = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const response = await fetch('/api/cards');
        if (!response.ok) {
          const errorText = await response.text();
          console.error("HTTP error response text:", errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        const data: CardData[] = await response.json();
        setCards(data);
      } catch (error) {
        console.error("Failed to fetch cards:", error);
      }
    };

    fetchCards();
  }, []);

  const handleEdit = (card: CardData) => {
    setEditingCard(card);
  };

  const handleAddNew = async () => {
    const newId = Math.max(0, ...cards.map(c => c.id)) + 1;
    const newCard = {
      id: newId,
      title: 'New Card',
      frontDescription: '',
      backDescription: '',
      symbol: '🔄'
    };

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCard),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HTTP error response text:", errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data: CardData = await response.json();
      setCards([...cards, data]);
      setEditingCard(data);
    } catch (error) {
      console.error("Failed to add new card:", error);
    }
  };

  const handleSave = async (updatedCard: CardData) => {
    try {
      const response = await fetch('/api/cards', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedCard),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HTTP error response text:", errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data: CardData = await response.json();
      setCards(cards.map(card =>
        card.id === updatedCard.id ? data : card
      ));
      setEditingCard(null);
    } catch (error) {
      console.error("Failed to save card:", error);
    }
  };

  const handleDelete = async (cardId: number) => {
    try {
      const response = await fetch(`/api/cards?id=${cardId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HTTP error response text:", errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      setCards(cards.filter(card => card.id !== cardId));
      toast({
        title: "Card Deleted",
        description: "The card has been removed",
      });
    } catch (error) {
      console.error("Failed to delete card:", error);
    }
  };

  const handleExport = () => {
    // This function is no longer needed, but I'm keeping it for now
    // in case we want to implement a different export mechanism
    toast({
      title: "Export Ready",
      description: "Export functionality is not yet implemented.",
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
