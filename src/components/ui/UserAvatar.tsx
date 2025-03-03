import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/AuthContext";

export function UserAvatar() {
  const { user } = useAuth();
  
  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user) return 'U';
    
    const fullName = user.user_metadata?.full_name || '';
    if (!fullName) return user.email?.charAt(0).toUpperCase() || 'U';
    
    const nameParts = fullName.split(' ');
    if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase();
    
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <Avatar className="h-9 w-9 border">
      <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name || 'User'} />
      <AvatarFallback className="bg-sattva-100 text-sattva-800">{getUserInitials()}</AvatarFallback>
    </Avatar>
  );
}
