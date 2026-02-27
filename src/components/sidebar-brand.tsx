
'use client';

import { useFirebase } from '@/firebase';
import { Logo } from './logo';
import Link from 'next/link';

export function SidebarBrand() {
    const { companySettings } = useFirebase();
    const companyName = companySettings?.companyName || "Location Auto Pro";

    return (
        <Link href="/dashboard" className="flex items-center gap-3 font-bold text-lg">
            <Logo />
            <span className="truncate">{companyName}</span>
        </Link>
    );
}
