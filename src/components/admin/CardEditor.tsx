import { Plus, Save, Trash2, Upload, X } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CardData, SourceData } from '@/data/cards'
import { useToast } from '@/hooks/use-toast'

interface CardEditorProps {
  card: CardData
  onSave: (updatedCard: CardData) => void
  onCancel: () => void
}

const CardEditor: React.FC<CardEditorProps> = ({ card, onSave, onCancel }) => {
  const [editedCard, setEditedCard] = useState<CardData>({
    ...card,
    sources: card.sources || [],
    tags: card.tags || [],
    includedInPalestineStack: card.includedInPalestineStack || false,
    isFeatured: card.isFeatured || false,
  })
  const [newSource, setNewSource] = useState<SourceData>({ text: '', url: '' })
  const [newTag, setNewTag] = useState('')
  const { toast } = useToast()

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setEditedCard((prev) => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (field: string, checked: boolean) => {
    setEditedCard((prev) => ({
      ...prev,
      [field]: checked,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Simple validation
    if (
      !editedCard.title.trim() ||
      !editedCard.frontDescription.trim() ||
      !editedCard.backDescription.trim()
    ) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        variant: 'destructive',
      })
      return
    }

    onSave(editedCard)
    toast({
      title: 'Card Saved',
      description: 'The card has been updated successfully',
    })
  }

  const addSource = () => {
    if (newSource.text.trim()) {
      setEditedCard((prev) => ({
        ...prev,
        sources: [...(prev.sources || []), { ...newSource }],
      }))
      setNewSource({ text: '', url: '' })
    }
  }

  const removeSource = (index: number) => {
    setEditedCard((prev) => ({
      ...prev,
      sources: prev.sources?.filter((_, i) => i !== index) || [],
    }))
  }

  const addTag = () => {
    if (newTag.trim() && !editedCard.tags?.includes(newTag.trim())) {
      setEditedCard((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()],
      }))
      setNewTag('')
    }
  }

  const removeTag = (index: number) => {
    setEditedCard((prev) => ({
      ...prev,
      tags: prev.tags?.filter((_, i) => i !== index) || [],
    }))
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 p-6 border border-border rounded-lg bg-card"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium">Edit Card</h3>
        <div className="flex space-x-2">
          <Button type="submit" size="sm" className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex items-center gap-2"
          >
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
          <Label htmlFor="imageUrl">Image URL</Label>
          <div className="flex gap-2">
            <Input
              id="imageUrl"
              name="imageUrl"
              value={editedCard.imageUrl || ''}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // This would typically open a file picker in a real application
                toast({
                  title: 'Feature Notice',
                  description:
                    'Image upload functionality would be implemented here',
                })
              }}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
          {editedCard.imageUrl && (
            <div className="mt-2 h-32 w-full rounded-md overflow-hidden border border-border">
              <img
                src={editedCard.imageUrl}
                alt="Preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://placehold.co/600x400?text=Invalid+Image'
                }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includedInPalestineStack"
              checked={editedCard.includedInPalestineStack || false}
              onCheckedChange={(checked) =>
                handleCheckboxChange(
                  'includedInPalestineStack',
                  checked as boolean,
                )
              }
            />
            <label
              htmlFor="includedInPalestineStack"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include in Israel/Palestine stack
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isFeatured"
              checked={editedCard.isFeatured || false}
              onCheckedChange={(checked) =>
                handleCheckboxChange('isFeatured', checked as boolean)
              }
            />
            <label
              htmlFor="isFeatured"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Set as featured card
            </label>
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
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {editedCard.tags?.map((tag, index) => (
              <div
                key={index}
                className="flex items-center bg-muted rounded-full px-3 py-1 text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  className="ml-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Input
              placeholder="Add a tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
            />
            <Button type="button" onClick={addTag} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sources</Label>

          <div className="space-y-2">
            {editedCard.sources?.map((source, index) => (
              <div
                key={index}
                className="flex flex-col space-y-2 p-3 border border-border rounded-md"
              >
                <div className="flex items-start gap-2">
                  <Input
                    value={source.text}
                    onChange={(e) => {
                      const newSources = [...(editedCard.sources || [])]
                      newSources[index] = {
                        ...newSources[index],
                        text: e.target.value,
                      }
                      setEditedCard((prev) => ({
                        ...prev,
                        sources: newSources,
                      }))
                    }}
                    placeholder="Source text"
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
                <Input
                  value={source.url || ''}
                  onChange={(e) => {
                    const newSources = [...(editedCard.sources || [])]
                    newSources[index] = {
                      ...newSources[index],
                      url: e.target.value,
                    }
                    setEditedCard((prev) => ({
                      ...prev,
                      sources: newSources,
                    }))
                  }}
                  placeholder="Source URL (optional)"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col space-y-2 mt-2 p-3 border border-border rounded-md">
            <Input
              placeholder="Add a source citation"
              value={newSource.text}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, text: e.target.value }))
              }
            />
            <Input
              placeholder="Source URL (optional)"
              value={newSource.url}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, url: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSource()
                }
              }}
            />
            <Button type="button" onClick={addSource} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}

export default CardEditor
