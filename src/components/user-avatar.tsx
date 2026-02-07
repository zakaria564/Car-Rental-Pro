'use client';

import { useFirebase } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';

export function UserAvatar({ className }: { className?: string }) {
    const { auth, companySettings } = useFirebase();
    const user = auth.currentUser;

    const getInitials = (name?: string | null) => {
      if (!name) return 'AD';
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    }

    const fallback = getInitials(user?.displayName);
    const logoUrl = companySettings?.logoUrl;

    return (
        <Avatar className={cn("bg-secondary", className)}>
            {logoUrl ? (
                <AvatarImage src={logoUrl} alt="Logo de l'agence" className="object-contain" />
            ) : (
                <AvatarFallback className="bg-transparent text-secondary-foreground">{fallback}</AvatarFallback>
            )}
        </Avatar>
    );
}
