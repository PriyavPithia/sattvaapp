import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BellIcon, Search, Plus, LogOut, Settings, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  title: string;
  subtitle: string;
  showActions?: boolean;
}

export function Header({ title, subtitle, showActions = true }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [date] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  });

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user) return 'U';
    
    const fullName = user.user_metadata?.full_name || '';
    if (!fullName) return user.email?.charAt(0).toUpperCase() || 'U';
    
    const nameParts = fullName.split(' ');
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="w-full px-6 py-4 border-b animate-slide-in-bottom">
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <div className="text-muted-foreground text-sm">{date}</div>
          
          {user && (
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || 'User'} />
                      <AvatarFallback className="bg-sattva-100 text-sattva-700">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.user_metadata?.full_name || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className={cn(
              "text-xl text-transparent bg-clip-text bg-gradient-to-r",
              "from-sattva-500 to-sattva-700"
            )}>
              {subtitle}
            </p>
          </div>
          
          {showActions && (
            <div className="flex items-center space-x-2">
              {/* Removed "Ask AI" and "Create workspace" buttons */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
