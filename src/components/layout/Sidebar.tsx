import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  FileText, 
  MessageSquare, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

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

  const NavItem = ({ 
    to, 
    icon: Icon, 
    label 
  }: { 
    to: string; 
    icon: React.ElementType; 
    label: string 
  }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group",
        isActive 
          ? "bg-sattva-100 text-sattva-600" 
          : "text-gray-500 hover:bg-gray-100",
        collapsed && "justify-center px-3"
      )}
    >
      <Icon className={cn("h-5 w-5", collapsed && "h-6 w-6")} />
      {!collapsed && <span className="font-medium">{label}</span>}
      {collapsed && (
        <div className="absolute left-full ml-2 rounded-md px-2 py-1 bg-gray-900 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          {label}
        </div>
      )}
    </NavLink>
  );

  return (
    <div 
      className={cn(
        "flex h-screen flex-col border-r bg-white transition-all duration-300 relative",
        collapsed ? "w-[70px]" : "w-[250px]",
        className
      )}
    >
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-sattva-600 to-sattva-800 flex items-center justify-center">
              <span className="text-white font-semibold text-md">S</span>
            </div>
            <span className="font-bold text-lg">Sattva AI</span>
          </Link>
        )}
        {collapsed && (
          <Link to="/" className="mx-auto hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-sattva-600 to-sattva-800 flex items-center justify-center">
              <span className="text-white font-semibold text-md">S</span>
            </div>
          </Link>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className={cn(collapsed ? "absolute -right-3 top-4" : "")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex flex-col gap-1 p-3">
        <NavItem to="/dashboard" icon={FileText} label="Dashboard" />
        <NavItem to="/chat" icon={MessageSquare} label="Chat with AI" />
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </div>

      {user && (
        <div className="mt-auto">
          <div className={cn(
            "p-3 border-t flex items-center gap-3",
            collapsed && "justify-center"
          )}>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.user_metadata?.avatar_url} alt={user.user_metadata?.full_name || 'User'} />
              <AvatarFallback className="bg-sattva-100 text-sattva-700">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.user_metadata?.full_name || user.email}</p>
                <p className="text-xs text-gray-400 truncate">Online</p>
              </div>
            )}
            {!collapsed && (
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
