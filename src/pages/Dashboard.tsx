import { useState, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  FileText, 
  Upload, 
  BarChart, 
  Clock, 
  Plus, 
  ChevronDown,
  Trash,
  Edit,
  Search,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FileUploadModal } from '@/components/dashboard/FileUploadModal';
import { CreateKnowledgeBaseModal } from '@/components/dashboard/CreateKnowledgeBaseModal';
import { KnowledgebaseFiles } from '@/components/dashboard/KnowledgebaseFiles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { knowledgebaseService } from '@/lib/knowledgebaseService';
import { chatService } from '@/lib/chatService';
import { Knowledgebase } from '@/lib/supabase';
import { EditKnowledgeBaseModal } from '@/components/dashboard/EditKnowledgeBaseModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<Knowledgebase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<{id: string, title: string} | null>(null);
  const [viewingFiles, setViewingFiles] = useState(false);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [totalFileCount, setTotalFileCount] = useState<number>(0);
  const [aiInteractionsCount, setAiInteractionsCount] = useState<number>(0);
  const knowledgebaseFilesRef = useRef<{ refreshFiles: () => Promise<void> }>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedKnowledgeBaseForEdit, setSelectedKnowledgeBaseForEdit] = useState<Knowledgebase | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [knowledgeBaseToDelete, setKnowledgeBaseToDelete] = useState<string | null>(null);
  
  // Fetch knowledgebases on component mount
  useEffect(() => {
    const fetchKnowledgebases = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const kbs = await knowledgebaseService.getUserKnowledgebases(user.id);
        setKnowledgeBases(kbs);
        
        // Fetch file counts for all knowledgebases
        if (kbs.length > 0) {
          const kbIds = kbs.map(kb => kb.id);
          const counts = await knowledgebaseService.getKnowledgebaseFileCounts(kbIds);
          setFileCounts(counts);
        }

        // Fetch total file count
        const totalFiles = await knowledgebaseService.getUserTotalFileCount(user.id);
        setTotalFileCount(totalFiles);

        // Fetch AI interactions count
        const aiInteractions = await chatService.getUserAIInteractionsCount(user.id);
        setAiInteractionsCount(aiInteractions);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchKnowledgebases();
  }, [user]);
  
  const filteredKnowledgeBases = knowledgeBases.filter(kb => 
    kb.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    kb.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateKnowledgeBase = async (name: string, description: string) => {
    if (!user) return;
    
    try {
      const newKnowledgeBase = await knowledgebaseService.createKnowledgebase(
        user.id,
        name,
        description
      );
      
      setKnowledgeBases([...knowledgeBases, newKnowledgeBase]);
      toast.success('Knowledge base created successfully');
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast.error('Failed to create knowledge base');
    }
  };

  const handleAddFiles = (kbId: string, kbTitle: string) => {
    setSelectedKnowledgeBase({ id: kbId, title: kbTitle });
    setIsFileUploadModalOpen(true);
  };

  const handleViewFiles = (kbId: string, kbTitle: string) => {
    setSelectedKnowledgeBase({ id: kbId, title: kbTitle });
    setViewingFiles(true);
  };

  const handleBackToKnowledgeBases = () => {
    setViewingFiles(false);
    setSelectedKnowledgeBase(null);
  };

  const handleChatWithAI = (kbId: string) => {
    navigate(`/chat?kb=${kbId}`);
  };

  const confirmDeleteKnowledgeBase = (kbId: string) => {
    setKnowledgeBaseToDelete(kbId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteKnowledgeBase = async () => {
    if (!knowledgeBaseToDelete) return;
    
    try {
      await knowledgebaseService.deleteKnowledgebase(knowledgeBaseToDelete);
      setKnowledgeBases(knowledgeBases.filter(kb => kb.id !== knowledgeBaseToDelete));
      toast.success('Knowledge base deleted successfully');
    } catch (error) {
      console.error('Error deleting knowledge base:', error);
      toast.error('Failed to delete knowledge base');
    } finally {
      setKnowledgeBaseToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleEditKnowledgeBase = (kbId: string) => {
    const knowledgeBase = knowledgeBases.find(kb => kb.id === kbId);
    if (knowledgeBase) {
      setSelectedKnowledgeBaseForEdit(knowledgeBase);
      setIsEditModalOpen(true);
    } else {
      toast.error('Knowledge base not found');
    }
  };

  const handleUpdateKnowledgeBase = async (id: string, title: string, description: string) => {
    try {
      const updatedKb = await knowledgebaseService.updateKnowledgebase(id, title, description);
      
      // Update the knowledge base in the state
      setKnowledgeBases(prevKbs => 
        prevKbs.map(kb => kb.id === id ? updatedKb : kb)
      );
      
      toast.success('Knowledge base updated successfully');
    } catch (error) {
      console.error('Error updating knowledge base:', error);
      toast.error('Failed to update knowledge base');
    }
  };

  const handleAddNewTask = () => {
    toast.info('Task creation functionality coming soon!');
  };

  const handleCreateTask = () => {
    toast.info('Task creation functionality coming soon!');
  };

  // Format date string from ISO to relative time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
      const months = Math.floor(diffInDays / 30);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title={`Hello, ${user?.user_metadata?.full_name || 'User'}`} 
          subtitle="How can I help you today?" 
        />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Knowledge Bases</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{knowledgeBases.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Your personal knowledge repository</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Files</CardTitle>
                <Upload className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalFileCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all knowledge bases</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">AI Interactions</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{aiInteractionsCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Questions answered by AI</p>
              </CardContent>
            </Card>
          </div>
          
          {viewingFiles && selectedKnowledgeBase ? (
            <KnowledgebaseFiles 
              ref={knowledgebaseFilesRef}
              knowledgebaseId={selectedKnowledgeBase.id}
              knowledgebaseTitle={selectedKnowledgeBase.title}
              onBack={handleBackToKnowledgeBases}
              onAddFiles={() => handleAddFiles(selectedKnowledgeBase.id, selectedKnowledgeBase.title)}
            />
          ) : (
            <>
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">My Knowledge Bases</h2>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                      <Input 
                        placeholder="Search knowledge bases..." 
                        className="pl-9 w-[250px]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button 
                      className="bg-sattva-600 hover:bg-sattva-700"
                      onClick={() => setIsCreateModalOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New
                    </Button>
                  </div>
                </div>
                
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sattva-600"></div>
                  </div>
                ) : filteredKnowledgeBases.length === 0 ? (
                  <div className="bg-white rounded-lg border p-8 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <FileText className="h-6 w-6 text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No knowledge bases found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchQuery 
                        ? "No knowledge bases match your search criteria." 
                        : "Create your first knowledge base to get started."}
                    </p>
                    {!searchQuery && (
                      <Button 
                        className="bg-sattva-600 hover:bg-sattva-700"
                        onClick={() => setIsCreateModalOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Knowledge Base
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredKnowledgeBases.map((kb) => (
                      <Card 
                        key={kb.id} 
                        className="hover:shadow-md transition-all duration-200 hover:-translate-y-1 cursor-pointer"
                        onClick={() => handleViewFiles(kb.id, kb.title)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle>{kb.title}</CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">{kb.description}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditKnowledgeBase(kb.id);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDeleteKnowledgeBase(kb.id);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center">
                              <Badge variant="outline" className="mr-2">
                                {fileCounts[kb.id] || 0} files
                              </Badge>
                            </div>
                          </div>
                          
                          <Progress value={0} className="h-1 mb-4" />
                          
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddFiles(kb.id, kb.title);
                              }}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Add Files
                            </Button>
                            <Button 
                              size="sm"
                              className="flex-1 bg-sattva-600 hover:bg-sattva-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleChatWithAI(kb.id);
                              }}
                            >
                              Chat with AI
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      
      {isCreateModalOpen && (
        <CreateKnowledgeBaseModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateKnowledgeBase}
        />
      )}
      
      {isFileUploadModalOpen && selectedKnowledgeBase && (
        <FileUploadModal
          isOpen={true}
          onClose={() => setIsFileUploadModalOpen(false)}
          knowledgeBaseId={selectedKnowledgeBase.id}
          knowledgeBaseTitle={selectedKnowledgeBase.title}
          userId={user?.id || ''}
          onSuccess={() => {
            // Refresh file counts after upload
            if (knowledgeBases.length > 0) {
              const kbIds = knowledgeBases.map(kb => kb.id);
              knowledgebaseService.getKnowledgebaseFileCounts(kbIds)
                .then(counts => setFileCounts(counts))
                .catch(err => console.error('Error refreshing file counts:', err));
            }
            
            // Refresh files list if viewing files
            if (viewingFiles && knowledgebaseFilesRef.current) {
              knowledgebaseFilesRef.current.refreshFiles();
            }
          }}
        />
      )}
      
      {isEditModalOpen && selectedKnowledgeBaseForEdit && (
        <EditKnowledgeBaseModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleUpdateKnowledgeBase}
          knowledgeBase={selectedKnowledgeBaseForEdit}
        />
      )}
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this knowledge base?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the knowledge base and all its files.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setKnowledgeBaseToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteKnowledgeBase}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
