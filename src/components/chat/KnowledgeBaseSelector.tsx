import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Database, Loader2 } from 'lucide-react';
import { knowledgebaseService } from '@/lib/knowledgebaseService';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import type { Knowledgebase } from '@/lib/supabase';

type KnowledgeBaseSelectorProps = {
  onSelect: (knowledgeBase: Knowledgebase) => void;
  initialKnowledgeBaseId?: string;
};

export function KnowledgeBaseSelector({ onSelect, initialKnowledgeBaseId }: KnowledgeBaseSelectorProps) {
  const { user } = useAuth();
  const [knowledgebases, setKnowledgebases] = useState<Knowledgebase[]>([]);
  const [selectedKB, setSelectedKB] = useState<Knowledgebase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchKnowledgebases();
    }
  }, [user]);

  const fetchKnowledgebases = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const kbs = await knowledgebaseService.getUserKnowledgebases(user.id);
      setKnowledgebases(kbs);
      
      // If there are knowledgebases, select the first one or the one specified by initialKnowledgeBaseId
      if (kbs.length > 0) {
        if (initialKnowledgeBaseId) {
          const initialKB = kbs.find(kb => kb.id === initialKnowledgeBaseId);
          if (initialKB) {
            setSelectedKB(initialKB);
            onSelect(initialKB);
          } else {
            setSelectedKB(kbs[0]);
            onSelect(kbs[0]);
          }
        } else {
          setSelectedKB(kbs[0]);
          onSelect(kbs[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching knowledgebases:', error);
      toast.error('Failed to load knowledge bases');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (kb: Knowledgebase) => {
    setSelectedKB(kb);
    onSelect(kb);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            <span>
              {loading 
                ? 'Loading knowledge bases...' 
                : selectedKB 
                  ? selectedKB.title 
                  : knowledgebases.length === 0 
                    ? 'No knowledge bases found' 
                    : 'Select Knowledge Base'
              }
            </span>
          </div>
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[250px]">
        <DropdownMenuLabel>Knowledge Bases</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : knowledgebases.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
            No knowledge bases found
          </div>
        ) : (
          knowledgebases.map((kb) => (
            <DropdownMenuItem
              key={kb.id}
              onClick={() => handleSelect(kb)}
              className={kb.id === selectedKB?.id ? 'bg-sattva-50' : ''}
            >
              {kb.title}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
