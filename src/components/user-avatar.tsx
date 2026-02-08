
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
        <Avatar className={cn("bg-secondary h-full w-full [clip-path:polygon(50%_0%,_61%_35%,_98%_35%,_68%_57%,_79%_91%,_50%_70%,_21%_91%,_32%_57%,_2%_35%,_39%_35%)]", className)}>
            {logoUrl ? (
                <AvatarImage src={logoUrl} alt="Logo de l'agence" className="object-cover" />
            ) : (
                <AvatarFallback className="bg-transparent text-secondary-foreground">{fallback}</AvatarFallback>
            )}
        </Avatar>
    );
}
