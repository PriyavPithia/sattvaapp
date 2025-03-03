import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Knowledgebase } from '@/lib/supabase';

export type EditKnowledgeBaseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, name: string, description: string) => Promise<void>;
  knowledgeBase: Knowledgebase | null;
};

export function EditKnowledgeBaseModal({ 
  isOpen, 
  onClose, 
  onSubmit,
  knowledgeBase
}: EditKnowledgeBaseModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Set initial values when knowledgeBase changes
  useEffect(() => {
    if (knowledgeBase) {
      setName(knowledgeBase.title);
      setDescription(knowledgeBase.description || '');
    }
  }, [knowledgeBase]);

  const handleUpdate = async () => {
    if (!knowledgeBase) return;
    
    if (!name) {
      toast.error('Please enter a name for your knowledge base');
      return;
    }

    setIsUpdating(true);
    
    try {
      await onSubmit(knowledgeBase.id, name, description);
      onClose();
    } catch (error) {
      console.error('Error updating knowledge base:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Knowledge Base</DialogTitle>
          <DialogDescription>
            Update the details of your knowledge base.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="name"
              placeholder="e.g., Research Papers, Product Documentation"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description (optional)
            </label>
            <Input
              id="description"
              placeholder="e.g., Contains research papers from Q1 2023"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button 
            className="bg-sattva-600 hover:bg-sattva-700" 
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update Knowledge Base'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 