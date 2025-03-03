import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Heading3,
  Save,
  Trash,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import { toast } from 'sonner';

interface RichTextEditorProps {
  onSave?: (title: string, content: string) => void;
  initialContent?: string;
  className?: string;
}

export function RichTextEditor({
  onSave,
  initialContent = '',
  className = '',
}: RichTextEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent;
    }
  }, [initialContent]);

  const handleContentChange = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const handleFormat = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    handleContentChange();
    // Focus back on the editor
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Please enter a title for your note');
      return;
    }

    if (!content.trim() || content === '<br>') {
      toast.error('Please enter some content for your note');
      return;
    }

    if (onSave) {
      onSave(title, content);
    }
  };

  const handleClear = () => {
    setTitle('');
    setContent('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create Note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="note-title" className="text-sm font-medium">
            Note Title
          </label>
          <Input
            id="note-title"
            placeholder="Enter a title for your note"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-1 p-1 border rounded-md bg-muted/30">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('bold')}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('italic')}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('underline')}
              title="Underline"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <div className="w-px h-8 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('insertUnorderedList')}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('insertOrderedList')}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <div className="w-px h-8 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('formatBlock', '<h1>')}
              title="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('formatBlock', '<h2>')}
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('formatBlock', '<h3>')}
              title="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </Button>
            <div className="w-px h-8 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('justifyLeft')}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('justifyCenter')}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleFormat('justifyRight')}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            className="min-h-[200px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            onInput={handleContentChange}
            onBlur={handleContentChange}
          />
          
          <div className="text-xs text-muted-foreground mt-1">
            {content.length} characters
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleClear}
        >
          <Trash className="h-4 w-4 mr-2" />
          Clear
        </Button>
        
        <Button
          onClick={handleSave}
          disabled={!title.trim() || !content.trim() || content === '<br>'}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Note
        </Button>
      </CardFooter>
    </Card>
  );
} 