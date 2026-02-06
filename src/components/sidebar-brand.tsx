'use client';

import { useFirebase } from '@/firebase';
import { Logo } from './logo';
import Link from 'next/link';

export function SidebarBrand() {
    const { companySettings } = useFirebase();
    const companyName = companySettings?.companyName || "Location Auto Pro";

    return (
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Logo />
            <span className="">{companyName}</span>
        </Link>
    );
}
