import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  
  // API settings
  const [openAiKey, setOpenAiKey] = useState('');
  const [modelVersion, setModelVersion] = useState('gpt-3.5-turbo');
  
  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    
    try {
      // Here you would implement the profile update logic with Supabase
      // For now, we'll just show a success message
      setTimeout(() => {
        toast.success('Profile updated successfully');
        setIsUpdating(false);
      }, 1000);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      setIsUpdating(false);
    }
  };
  
  const handleSaveNotifications = () => {
    toast.success('Notification preferences saved');
  };
  
  const handleSaveApiSettings = () => {
    toast.success('API settings saved');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Settings" 
          subtitle="Manage your account and preferences" 
          showActions={false}
        />
        
        <main className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="api">API Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>
                    Update your account details and profile information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input 
                      id="full-name" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      disabled 
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed. Contact support if you need to update your email.
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="bg-sattva-600 hover:bg-sattva-700"
                    onClick={handleUpdateProfile}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating...' : 'Update Profile'}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Manage how and when you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Email Notifications</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch 
                      checked={emailNotifications} 
                      onCheckedChange={setEmailNotifications} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">AI Suggestions</h4>
                      <p className="text-sm text-muted-foreground">
                        Get AI-powered suggestions for your knowledge bases
                      </p>
                    </div>
                    <Switch 
                      checked={aiSuggestions} 
                      onCheckedChange={setAiSuggestions} 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Weekly Digest</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive a weekly summary of your activity
                      </p>
                    </div>
                    <Switch 
                      checked={weeklyDigest} 
                      onCheckedChange={setWeeklyDigest} 
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="bg-sattva-600 hover:bg-sattva-700"
                    onClick={handleSaveNotifications}
                  >
                    Save Preferences
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="api">
              <Card>
                <CardHeader>
                  <CardTitle>API Settings</CardTitle>
                  <CardDescription>
                    Configure your API keys and model preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key (Optional)</Label>
                    <Input 
                      id="openai-key" 
                      type="password" 
                      value={openAiKey} 
                      onChange={(e) => setOpenAiKey(e.target.value)} 
                      placeholder="sk-..." 
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide your own OpenAI API key to use your own quota. Leave blank to use our shared quota.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="model-version">AI Model Version</Label>
                    <select 
                      id="model-version"
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      value={modelVersion}
                      onChange={(e) => setModelVersion(e.target.value)}
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Default)</option>
                      <option value="gpt-4">GPT-4 (Premium)</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Select the AI model to use for your knowledge base queries.
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="bg-sattva-600 hover:bg-sattva-700"
                    onClick={handleSaveApiSettings}
                  >
                    Save API Settings
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Settings; 