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
import { Gavel } from 'lucide-react';
import { Button } from '../ui/button';


export const ReadOnlyCheckbox = ({ checked }: { checked: boolean | undefined }) => (
    <div
        className="h-4 w-4 border border-black flex items-center justify-center"
        style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
        {checked && <div className="h-2.5 w-2.5 bg-black" />}
    </div>
);

export const DeprecatedInspectionView: React.FC<{ data: any, type: 'depart' | 'retour' }> = ({ data, type }) => {
    if (!data) return null;
    const damageEntries = Object.entries(data.dommages || {});
    const safeDate = data.dateHeure?.toDate ? format(data.dateHeure.toDate(), "dd/MM/yyyy HH:mm", { locale: fr }) : 'N/A';

    return (
        <div className="space-y-2">
            <h4 className="font-bold text-base">{type === 'depart' ? 'Livraison (Départ)' : 'Réception (Retour)'}</h4>
            <div className="space-y-1">
                <div><strong>Date:</strong> {safeDate}</div>
                <div><strong>Kilométrage:</strong> {data.kilometrage?.toLocaleString()} km</div>
                <div><strong>Niveau Carburant:</strong> {data.carburantNiveau ? data.carburantNiveau * 100 : 0}%</div>
            </div>
            <div className="mt-2 text-xs">
                <strong>Check-list des accessoires:</strong>
                <div className="grid grid-cols-2 gap-x-4">
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={data.roueSecours} /> Roue de secours</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={data.cric} /> Cric & manivelle</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={data.giletTriangle} /> Gilet & triangle</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={data.posteRadio} /> Poste radio</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={data.doubleCles} /> Double des clés</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={data.lavage} /> Voiture propre</div>
                </div>
            </div>

            {data.dommagesNotes && <p className="text-xs italic mt-1"><strong>Notes:</strong> {data.dommagesNotes}</p>}
            
            {damageEntries.length > 0 && (
                <div className="mt-2 text-xs">
                    <strong>Dommages constatés:</strong>
                    <ul className="list-disc list-inside">
                        {damageEntries.map(([partId, damageType]) => {
                           const part = carParts.find(p => p.id === partId);
                           const damage = damageTypes[damageType as DamageType];
                           if (!part || !damage) return null;
                           return ( <li key={partId}>{part.label}: {damage.label}</li> )
                        })}
                    </ul>
                </div>
            )}
             <div className="mt-2 no-print">
                <strong className="block mb-1 font-semibold">Schéma des dommages:</strong>
                <CarDamageDiagram damages={data.dommages || {}} onDamagesChange={() => {}} readOnly showLegend={false} />
            </div>
            {data.photos && data.photos.length > 0 && (
                <div className="mt-2 no-print">
                    <strong className="text-xs font-semibold">Photos ({type === 'depart' ? 'Départ' : 'Retour'}):</strong>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                        {data.photos.map((photoUrl: string, index: number) => (
                           photoUrl && photoUrl.startsWith('http') && (
                            <a key={index} href={photoUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-square block hover:opacity-80 transition-opacity">
                                <Image
                                    src={photoUrl}
                                    alt={`Photo ${type} ${index + 1}`}
                                    fill
                                    className="rounded-md object-cover"
                                />
                            </a>
                           )
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const InspectionDetailsView: React.FC<{ inspectionId: string, type: 'depart' | 'retour' }> = ({ inspectionId, type }) => {
    const [inspection, setInspection] = React.useState<Inspection | null>(null);
    const [loading, setLoading] = React.useState(true);
    const { firestore } = useFirebase();

    React.useEffect(() => {
        if (!firestore || !inspectionId) {
            setLoading(false);
            return;
        };
        
        setLoading(true);
        const inspectionRef = doc(firestore, 'inspections', inspectionId);
        const damagesRef = collection(firestore, `inspections/${inspectionId}/damages`);

        const unsubInspection = onSnapshot(inspectionRef, (docSnap) => {
            if (docSnap.exists()) {
                const inspectionData = docSnap.data() as Omit<Inspection, 'id' | 'damages'>;
                setInspection(prev => {
                    const base = prev || { id: docSnap.id, damages: [] } as any;
                    return { ...base, ...inspectionData, id: docSnap.id };
                });
                setLoading(false);
            } else {
                setInspection(null);
                setLoading(false);
            }
        }, (error) => {
            console.error("Failed to listen to inspection details:", error);
            setLoading(false);
        });

        const unsubDamages = onSnapshot(damagesRef, (damagesSnap) => {
            const damages = damagesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Damage));
            setInspection(prev => {
                if (!prev) return null;
                return { ...prev, damages };
            });
        }, (error) => {
            console.error("Failed to listen to damages:", error);
        });

        return () => {
            unsubInspection();
            unsubDamages();
        };
    }, [firestore, inspectionId]);
    
    const damagesForDiagram = React.useMemo(() => {
        if (!inspection?.damages) return {};
        return inspection.damages.reduce((acc, damage) => {
            const partId = damage.partName as keyof typeof acc;
            if (partId && damageTypes[damage.damageType]) {
                acc[partId] = damage.damageType;
            }
            return acc;
        }, {} as { [key: string]: DamageType });
    }, [inspection?.damages]);


    if (loading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-40 w-full mt-2" />
            </div>
        );
    }

    if (!inspection) {
        return type === 'retour' ? <p>Véhicule non retourné.</p> : <p>Détails de l'inspection de départ non trouvés.</p>;
    }
    
    const damageEntries = Object.entries(damagesForDiagram);
    const safeInspectionDate = inspection.timestamp?.toDate ? format(inspection.timestamp.toDate(), "dd/MM/yyyy HH:mm", { locale: fr }) : 'N/A';

    return (
        <div className="space-y-2">
            <h4 className="font-bold text-base">{inspection.type === 'depart' ? 'Livraison (Départ)' : 'Réception (Retour)'}</h4>
            <div className="space-y-1">
                <div><strong>Date:</strong> {safeInspectionDate}</div>
                <div><strong>Kilométrage:</strong> {inspection.kilometrage.toLocaleString()} km</div>
                <div><strong>Niveau Carburant:</strong> {inspection.carburantNiveau * 100}%</div>
            </div>
             <div className="mt-2 text-xs">
                <strong>Check-list des accessoires:</strong>
                 <div className="grid grid-cols-2 gap-x-4">
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={inspection.roueSecours} /> Roue de secours</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={inspection.cric} /> Cric & manivelle</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={inspection.giletTriangle} /> Gilet & triangle</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={inspection.posteRadio} /> Poste radio</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={inspection.doubleCles} /> Double des clés</div>
                    <div className="flex items-center gap-2"><ReadOnlyCheckbox checked={inspection.lavage} /> Voiture propre</div>
                </div>
            </div>

            {inspection.notes && <p className="text-xs italic mt-1"><strong>Notes:</strong> {inspection.notes}</p>}
            
            {damageEntries.length > 0 && (
                <div className="mt-2 text-xs">
                    <strong>Dommages constatés:</strong>
                    <ul className="list-disc list-inside">
                        {damageEntries.map(([partId, damageType]) => {
                           const part = carParts.find(p => p.id === partId);
                           const damage = damageTypes[damageType as DamageType];
                           if (!part || !damage) return null;
                           return ( <li key={partId}>{part.label}: {damage.label}</li> )
                        })}
                    </ul>
                </div>
            )}
             <div className="mt-2 no-print">
                <strong className="block mb-1 font-semibold">Schéma des dommages:</strong>
                <CarDamageDiagram damages={damagesForDiagram} onDamagesChange={() => {}} readOnly showLegend={false} />
            </div>
            {inspection.photos && inspection.photos.length > 0 && (
                <div className="mt-2 no-print">
                    <strong className="text-xs font-semibold">Photos ({type === 'depart' ? 'Départ' : 'Retour'}):</strong>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                        {inspection.photos.map((photoUrl, index) => (
                            photoUrl && photoUrl.startsWith('http') && (
                            <a key={index} href={photoUrl} target="_blank" rel="noopener noreferrer" className="relative aspect-square block hover:opacity-80 transition-opacity">
                                <Image
                                    src={photoUrl}
                                    alt={`Photo ${type} ${index + 1}`}
                                    fill
                                    className="rounded-md object-cover"
                                />
                            </a>
                            )
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const ConditionsGenerales = () => (
    <div className="text-xs text-muted-foreground space-y-2 p-2 border rounded-md">
      <h4 className="font-bold text-center text-sm">CONDITIONS GÉNÉRALES DE LOCATION</h4>
      <p><strong>1. Utilisation du Véhicule:</strong> Le locataire s'engage à conduire avec prudence et à respecter le code de la route. Il est interdit de sous-louer le véhicule, de participer à des compétitions, ou de conduire sous l'emprise d'alcool/stupéfiants.</p>
      <p><strong>2. État du Véhicule:</strong> Le véhicule est livré en parfait état de marche, sauf annotations sur la fiche d'état. Le locataire est responsable de la vérification des niveaux tous les 500 km. Tout dommage non signalé au départ sera facturé.</p>
      <p><strong>3. Assurance et Responsabilité:</strong> Une franchise reste à la charge du locataire en cas d'accident responsable ou sans tiers identifié. Les dommages aux pneumatiques, jantes, bris de glace et intérieur ne sont pas couverts par l'assurance standard.</p>
      <p><strong>4. Restitution:</strong> Le véhicule doit être restitué à la date et heure prévues. Tout retard peut entraîner la facturation d'une journée supplémentaire. Le carburant doit être au même niveau qu'au départ, sinon il sera facturé.</p>
      <p><strong>5. Amendes:</strong> Le locataire est seul responsable des amendes et contraventions durant la location.</p>
      <p><strong>6. Dépôt de Garantie:</strong> La caution couvre les éventuels dommages ou frais supplémentaires et sera restituée après vérification finale.</p>
      <p><strong>7. Litiges:</strong> En cas de litige, le tribunal compétent est celui du siège social de l'agence.</p>
    </div>
  );

export function RentalDetails({ rental, isArchived = false }: { rental: Rental, isArchived?: boolean }) {
    const { firestore, companySettings } = useFirebase();
    const [archivedPayments, setArchivedPayments] = React.useState<Payment[]>([]);
    const [paymentsLoading, setPaymentsLoading] = React.useState(isArchived);

    React.useEffect(() => {
        if (!isArchived || !firestore || !rental.id) {
            setPaymentsLoading(false);
            return;
        }

        setPaymentsLoading(true);
        const paymentsQuery = query(collection(firestore, "archived_payments"), where("rentalId", "==", rental.id));
        
        const unsubscribe = onSnapshot(paymentsQuery, (querySnapshot) => {
            const paymentsData = querySnapshot.docs.map(doc => ({...doc.data(), id: doc.id } as Payment));
            setArchivedPayments(paymentsData);
            setPaymentsLoading(false);
        }, (error) => {
            console.error("Error fetching archived payments:", error);
            setPaymentsLoading(false);
        });

        return () => unsubscribe();
    }, [isArchived, firestore, rental.id]);

    const safeDebutDate = getRentalDate(rental, 'dateDebut');
    const safeFinDate = getRentalDate(rental, 'dateFin');

    const totalAmount = calculateTotalRentalAmount(rental);
    const amountPaid = isArchived
        ? archivedPayments.reduce((acc, payment) => acc + payment.amount, 0)
        : rental.location.montantPaye || 0;
    const amountRemaining = Math.max(0, totalAmount - amountPaid);

    const rentalDuration = () => {
        if (safeDebutDate && safeFinDate) {
             if (startOfDay(safeDebutDate).getTime() === startOfDay(safeFinDate).getTime()) {
                return 1;
            }
            const daysDiff = differenceInCalendarDays(safeFinDate, safeDebutDate) || 1;
            return daysDiff;
        }
        return rental.location.nbrJours || 0;
    };

    const agencyName = companySettings?.companyName || "Location Auto Pro";

    return (
      <ScrollArea className="h-[80vh]">
        <div className="p-1" id="printable-contract">
          <div className="printable-contract-body flex flex-col h-full min-h-[260mm] p-6 border rounded-md bg-white text-black" >
            {/* Header optimized for A4 / Logo at Left */}
            <header className="flex justify-between items-start pb-4 mb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <Logo className="h-20 w-20" />
                    <div>
                        <h2 className="font-bold text-xl uppercase tracking-tight">{agencyName}</h2>
                        <p className="text-xs text-gray-600">
                            Rabat, Maroc<br/>
                            Tél: +212 537 00 00 00
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="font-bold text-lg uppercase tracking-tight">CONTRAT DE LOCATION {isArchived && '(ARCHIVÉ)'}</h1>
                    <p className="text-sm font-semibold">Contrat N°: <span className="font-mono text-primary-600">{rental.contractNumber}</span></p>
                    <p className="text-xs text-gray-500">Date: {format(getSafeDate(rental.createdAt) || new Date(), "dd/MM/yyyy", { locale: fr })}</p>
                </div>
            </header>
            
            <div className="space-y-4 flex-grow">
                 <div className="space-y-4 md:space-y-0 print:space-y-0 md:grid md:grid-cols-2 md:gap-x-4 print:grid print:grid-cols-2 print:gap-x-4">
                    <div className="border border-gray-200 p-3 rounded-md">
                        <h3 className="font-bold text-sm uppercase underline mb-2 bg-gray-50 p-1">LES PARTIES</h3>
                        <div className="space-y-1 text-sm">
                            <h4 className="font-bold text-xs uppercase text-gray-500">Conducteur Principal :</h4>
                            <div><strong>Nom:</strong> {rental.locataire.nomPrenom}</div>
                            <div><strong>CIN/Passeport:</strong> {rental.locataire.cin}</div>
                            <div><strong>Permis N°:</strong> {rental.locataire.permisNo}</div>
                            {rental.locataire.permisDateDelivrance && <div><strong>Délivré le :</strong> {format(getSafeDate(rental.locataire.permisDateDelivrance)!, "dd/MM/yyyy", { locale: fr })}</div>}
                            <div><strong>Téléphone:</strong> {rental.locataire.telephone}</div>
                        </div>
                        {rental.conducteur2 && (
                        <div className="space-y-1 mt-3 text-sm pt-2 border-t border-dashed border-gray-200">
                            <h4 className="font-bold text-xs uppercase text-gray-500">Deuxième Conducteur :</h4>
                            <div><strong>Nom:</strong> {rental.conducteur2.nomPrenom}</div>
                            <div><strong>CIN/Passeport:</strong> {rental.conducteur2.cin}</div>
                            <div><strong>Permis N°:</strong> {rental.conducteur2.permisNo}</div>
                            {rental.conducteur2.permisDateDelivrance && <div><strong>Délivré le :</strong> {format(getSafeDate(rental.conducteur2.permisDateDelivrance)!, "dd/MM/yyyy", { locale: fr })}</div>}
                             <div><strong>Téléphone:</strong> {rental.conducteur2.telephone}</div>
                        </div>
                        )}
                    </div>
                    <div className="border border-gray-200 p-3 rounded-md flex flex-col">
                        <h3 className="font-bold text-sm uppercase underline mb-2 bg-gray-50 p-1">DÉTAILS DE LA LOCATION</h3>
                        <div className="space-y-1 text-sm">
                            <h4 className="font-bold text-xs uppercase text-gray-500">Véhicule Loué :</h4>
                            <div><strong>Marque/Modèle:</strong> {rental.vehicule.marque}</div>
                            <div><strong>Immatriculation:</strong> {rental.vehicule.immatriculation}</div>
                            <div><strong>Carburant:</strong> {rental.vehicule.carburantType}</div>
                            <div><strong>Transmission:</strong> {rental.vehicule.transmission}</div>
                        </div>
                        <div className="space-y-1 mt-3 text-sm pt-2 border-t border-dashed border-gray-200">
                            <h4 className="font-bold text-xs uppercase text-gray-500">Période &amp; Coût :</h4>
                            <div><strong>Début:</strong> {safeDebutDate ? format(safeDebutDate, "dd/MM/yy 'à' HH:mm", { locale: fr }) : 'N/A'}</div>
                            <div><strong>Fin Prévue:</strong> {safeFinDate ? format(safeFinDate, "dd/MM/yy 'à' HH:mm", { locale: fr }) : 'N/A'}</div>
                            <div><strong>Lieu de départ:</strong> {rental.location.lieuDepart || 'Agence'}</div>
                            <div><strong>Durée:</strong> {rentalDuration()} jour(s)</div>
                            <div className="no-print"><strong>Dépôt de Caution:</strong> {formatCurrency(rental.location.depot || 0, 'MAD')}</div>
                        </div>
                        <div className="space-y-1 mt-auto pt-2 border-t border-gray-200 no-print">
                            <div className="flex justify-between"><span>Montant Total:</span> <span className="font-medium">{formatCurrency(totalAmount, 'MAD')}</span></div>
                            {paymentsLoading ? (
                                <div className="space-y-1">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-5 w-full" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between text-green-700"><span>Montant Payé:</span> <span className="font-medium">{formatCurrency(amountPaid, 'MAD')}</span></div>
                                    <div className={cn("flex justify-between font-bold", amountRemaining > 0.01 ? "text-red-600" : "text-gray-500")}><span>Reste à Payer:</span> <span>{formatCurrency(amountRemaining, 'MAD')}</span></div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                 <div className="border border-gray-200 p-3 rounded-md">
                    <h3 className="font-bold text-sm uppercase mb-2 underline bg-gray-50 p-1">ÉTAT DES LIEUX DU VÉHICULE</h3>
                    <div className="md:grid md:grid-cols-2 md:gap-x-4 print:grid print:grid-cols-2 print:gap-x-4">
                        <div>
                            {rental.livraisonInspectionId ? (
                                <InspectionDetailsView inspectionId={rental.livraisonInspectionId} type="depart" />
                            ) : rental.livraison ? (
                                <DeprecatedInspectionView data={rental.livraison} type="depart" />
                            ) : null }
                        </div>
                        <div className="mt-4 md:mt-0 print:mt-0 pt-4 md:pt-0 print:pt-0 md:border-l print:border-l md:pl-4 print:pl-4 border-gray-100">
                            {rental.receptionInspectionId ? (
                                <InspectionDetailsView inspectionId={rental.receptionInspectionId} type="retour" />
                            ) : rental.reception ? (
                                <DeprecatedInspectionView data={rental.reception} type="retour" />
                            ) : (
                               <div className="space-y-2">
                                 <h4 className="font-bold text-base">Réception (Retour)</h4>
                                 <p className="text-sm text-gray-400 italic">Véhicule non encore restitué.</p>
                               </div>
                            )}
                        </div>
                    </div>
                </div>
                 <div className="text-[10px] text-gray-500 mt-4 leading-tight italic">
                    <p>Le locataire reconnaît avoir reçu le véhicule en bon état de marche, avec tous les accessoires mentionnés, et s'engage à le restituer dans le même état de propreté et de fonctionnement au terme de la location.</p>
                </div>
            </div>

            {/* Signatures Footer */}
            <div className="signatures-section mt-auto pt-8 flex justify-between border-t border-gray-100">
                <div className="text-center w-2/5">
                    <p className="font-bold text-xs uppercase mb-1">Cachet et Signature de l'Agence</p>
                    <div className="mt-12 border-t border-gray-300 pt-1">
                        <p className="text-[10px] text-gray-400">(Précédée de la mention "Lu et approuvé")</p>
                    </div>
                </div>
                 <div className="text-center w-2/5">
                    <p className="font-bold text-xs uppercase mb-1">Signature du Locataire</p>
                    <div className="mt-12 border-t border-gray-300 pt-1">
                        <p className="text-[10px] text-gray-400">(Précédée de la mention "Lu et approuvé")</p>
                    </div>
                </div>
            </div>
            <div className="contract-footer text-center text-[10px] text-gray-400 mt-4">
                RC: 123456 | IF: 78901234 | ICE: 567890123456789 | Siège Social: Agdal, Rabat
            </div>
          </div>
          <div className="no-print p-4">
            <Collapsible>
                <CollapsibleTrigger asChild>
                    <Button variant="link" className="p-0 h-auto"><Gavel className="mr-2 h-4 w-4" />Voir les conditions générales</Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                    <ConditionsGenerales />
                </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </ScrollArea>
    );
}