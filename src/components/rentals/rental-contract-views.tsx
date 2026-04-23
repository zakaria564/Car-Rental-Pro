'use client';

import React from 'react';
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import Image from 'next/image';
import type { Rental, Damage, Inspection, DamageType, Payment } from "@/lib/definitions";
import { damageTypes } from "@/lib/definitions";
import { formatCurrency, cn, getSafeDate, getRentalDate, calculateTotalRentalAmount } from "@/lib/utils";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { ScrollArea } from "../ui/scroll-area";
import CarDamageDiagram, { carParts } from "./car-damage-diagram";
import { Skeleton } from "../ui/skeleton";
import { Logo } from "../logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Gavel, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';

export const ReadOnlyCheckbox = ({ checked }: { checked: boolean | undefined }) => (
    <div className="h-4 w-4 border border-black flex items-center justify-center" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
        {checked && <div className="h-2.5 w-2.5 bg-black" />}
    </div>
);

export const InspectionDetailsView: React.FC<{ inspectionId: string, type: 'depart' | 'retour' }> = ({ inspectionId, type }) => {
    const [inspection, setInspection] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const { firestore } = useFirebase();

    React.useEffect(() => {
        if (!firestore || !inspectionId) { setLoading(false); return; };
        const unsub = onSnapshot(doc(firestore, 'inspections', inspectionId), (snap) => {
            if (snap.exists()) setInspection(snap.data());
            setLoading(false);
        });
        return () => unsub();
    }, [firestore, inspectionId]);

    if (loading) return <Skeleton className="h-40 w-full" />;
    if (!inspection) return <p className="text-xs italic text-muted-foreground">{type === 'retour' ? 'Véhicule non retourné' : 'Données manquantes'}</p>;

    return (
        <div className="space-y-2 text-xs">
            <h4 className="font-bold text-sm uppercase border-b pb-1">{type === 'depart' ? 'Livraison' : 'Réception'}</h4>
            <p><strong>Km:</strong> {inspection.kilometrage?.toLocaleString()} km | <strong>Carburant:</strong> {Math.round((inspection.carburantNiveau || 0) * 100)}%</p>
            <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1"><ReadOnlyCheckbox checked={inspection.roueSecours} /> Roue secours</div>
                <div className="flex items-center gap-1"><ReadOnlyCheckbox checked={inspection.posteRadio} /> Radio</div>
                <div className="flex items-center gap-1"><ReadOnlyCheckbox checked={inspection.lavage} /> Propre</div>
                <div className="flex items-center gap-1"><ReadOnlyCheckbox checked={inspection.doubleCles} /> Double clés</div>
            </div>
            {inspection.photos && inspection.photos.length > 0 && (
                <div className="flex gap-2 mt-2 no-print overflow-x-auto pb-2">
                    {inspection.photos.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative h-16 w-16 shrink-0 rounded border overflow-hidden">
                            <Image src={url} alt="Photo inspection" fill className="object-cover" unoptimized />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export function RentalDetails({ rental }: { rental: Rental }) {
    const { companySettings } = useFirebase();
    const agencyName = companySettings?.companyName || "Location Auto Pro";
    const totalAmount = calculateTotalRentalAmount(rental);

    return (
      <ScrollArea className="h-[80vh]">
        <div className="p-1" id="printable-contract">
          <div className="printable-contract-body flex flex-col min-h-[280mm] p-8 border rounded-md bg-white text-black" >
            <header className="flex justify-between items-start pb-6 mb-8 border-b-2">
                <div className="flex items-center gap-4">
                    <Logo className="h-16 w-16" />
                    <div><h2 className="font-bold text-xl uppercase">{agencyName}</h2></div>
                </div>
                <div className="text-right">
                    <h1 className="font-bold text-lg">CONTRAT DE LOCATION</h1>
                    <p className="font-mono text-sm">N° {rental.contractNumber}</p>
                </div>
            </header>
            <div className="grid grid-cols-2 gap-8 mb-8 border p-4 rounded">
                <div className="space-y-1 text-sm">
                    <h3 className="font-bold border-b mb-2 uppercase">Locataire</h3>
                    <p><strong>Nom:</strong> {rental.locataire.nomPrenom}</p>
                    <p><strong>CIN:</strong> {rental.locataire.cin}</p>
                    <p><strong>Tél:</strong> {rental.locataire.telephone}</p>
                </div>
                <div className="space-y-1 text-sm">
                    <h3 className="font-bold border-b mb-2 uppercase">Véhicule</h3>
                    <p><strong>Marque:</strong> {rental.vehicule.marque}</p>
                    <p><strong>Immat:</strong> {rental.vehicule.immatriculation}</p>
                    <p><strong>Total:</strong> {formatCurrency(totalAmount, 'MAD')}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-8 flex-grow">
                <InspectionDetailsView inspectionId={rental.livraisonInspectionId || ''} type="depart" />
                <InspectionDetailsView inspectionId={rental.receptionInspectionId || ''} type="retour" />
            </div>
            <div className="mt-12 flex justify-between pt-8 border-t-2">
                <div className="text-center w-1/3"><p className="font-bold text-xs uppercase mb-12">Signature Agence</p><div className="border-t border-gray-400 pt-1"></div></div>
                <div className="text-center w-1/3"><p className="font-bold text-xs uppercase mb-12">Signature Locataire</p><div className="border-t border-gray-400 pt-1"></div></div>
            </div>
          </div>
        </div>
      </ScrollArea>
    );
}
