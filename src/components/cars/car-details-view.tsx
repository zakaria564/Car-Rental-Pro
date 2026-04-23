'use client';

import React from 'react';
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, ExternalLink } from "lucide-react";
import type { Car, Maintenance } from "@/lib/definitions";
import { formatCurrency, cn, getSafeDate } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Logo } from "../logo";
import { useFirebase } from '@/firebase';
import Image from 'next/image';

const getAvailabilityProps = (car: Car) => {
    switch (car.disponibilite) {
        case 'disponible':
            return { text: 'Disponible', className: 'bg-green-600' };
        case 'louee':
            return { text: 'Louée', className: 'bg-destructive' };
        case 'maintenance':
            return { text: 'En maintenance', className: 'bg-yellow-500' };
        default:
            return { text: 'Inconnu', className: 'bg-gray-500' };
    }
};

export type CarDetailsProps = {
  car: Car;
  groupedMaintenanceHistory: any[];
  filteredHistory: any[];
  historyFilterDate: Date | undefined;
  setHistoryFilterDate: (date: Date | undefined) => void;
  isArchived?: boolean;
};

export function CarDetails({ car, groupedMaintenanceHistory, filteredHistory, historyFilterDate, setHistoryFilterDate, isArchived = false }: CarDetailsProps) {
    const today = new Date();
    const availability = getAvailabilityProps(car);
    
    const assuranceDate = getSafeDate(car.dateExpirationAssurance);
    const isAssuranceExpired = assuranceDate && assuranceDate < today;
    const daysUntilAssuranceExpires = assuranceDate ? differenceInDays(assuranceDate, today) : null;
    const isAssuranceExpiringSoon = !isAssuranceExpired && daysUntilAssuranceExpires !== null && daysUntilAssuranceExpires >= 0 && daysUntilAssuranceExpires <= 7;

    const visiteDate = getSafeDate(car.dateProchaineVisiteTechnique);
    const isVisiteExpired = visiteDate && visiteDate < today;
    const daysUntilVisiteExpires = visiteDate ? differenceInDays(visiteDate, today) : null;
    const isVisiteExpiringSoon = !isVisiteExpired && daysUntilVisiteExpires !== null && daysUntilVisiteExpires >= 0 && daysUntilVisiteExpires <= 7;

    return (
        <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-4 text-sm">
                {car.photoURL && (
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border bg-muted group">
                        <a href={car.photoURL} target="_blank" rel="noopener noreferrer" className="block w-full h-full cursor-zoom-in">
                            <Image 
                                src={car.photoURL} 
                                alt={`${car.marque} ${car.modele}`} 
                                fill 
                                className="object-contain transition-transform group-hover:scale-105" 
                                unoptimized 
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ExternalLink className="text-white h-8 w-8" />
                            </div>
                        </a>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div><strong>Marque:</strong> {car.marque}</div>
                    <div><strong>Modèle:</strong> {car.modele}</div>
                    <div><strong>Mise en circulation:</strong> {getSafeDate(car.dateMiseEnCirculation) ? format(getSafeDate(car.dateMiseEnCirculation)!, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}</div>
                    <div><strong>Immatriculation:</strong> {car.immat}</div>
                    <div><strong>N° de châssis:</strong> {car.numChassis}</div>
                    <div><strong>Couleur:</strong> {car.couleur}</div>
                    <div><strong>Kilométrage:</strong> {car.kilometrage.toLocaleString()} km</div>
                    <div><strong>Carburant:</strong> {car.carburantType}</div>
                    <div><strong>Transmission:</strong> {car.transmission}</div>
                    <div><strong>Puissance:</strong> {car.puissance} cv</div>
                    <div><strong>Places:</strong> {car.nbrPlaces}</div>
                     {!isArchived && <div className="flex items-center gap-2"><strong>Disponibilité:</strong> <Badge variant="default" className={cn(availability.className, 'text-white')}>{availability.text}</Badge></div>}
                </div>
                <Separator />
                 <div className="space-y-2">
                    <h4 className="font-semibold text-base">Documents</h4>
                    <div className="flex items-center gap-2">
                        <strong>Expiration Assurance:</strong> {assuranceDate ? format(assuranceDate, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                        {isAssuranceExpired && <Badge variant="destructive">Expirée</Badge>}
                        {isAssuranceExpiringSoon && <Badge className="bg-amber-500 text-white">Expire bientôt</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                        <strong>Prochaine Visite:</strong> {visiteDate ? format(visiteDate, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                        {isVisiteExpired && <Badge variant="destructive">Expirée</Badge>}
                        {isVisiteExpiringSoon && <Badge className="bg-amber-500 text-white">Expire bientôt</Badge>}
                    </div>
                </div>
                
                {groupedMaintenanceHistory.length > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-3">
                           <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-base">Historique d'entretien</h4>
                                <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant={"outline"} className={cn("w-[200px] justify-start text-left font-normal h-8", !historyFilterDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {historyFilterDate ? format(historyFilterDate, "dd MMMM yyyy", { locale: fr }) : <span>Filtrer par date</span>}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                      <Calendar
                                        mode="single"
                                        selected={historyFilterDate}
                                        onSelect={setHistoryFilterDate}
                                        initialFocus
                                        locale={fr}
                                        captionLayout="dropdown"
                                        fromYear={new Date().getFullYear() - 10}
                                        toYear={new Date().getFullYear()}
                                      />
                                    </PopoverContent>
                                  </Popover>
                            </div>
                             <div className="space-y-3">
                                {filteredHistory.map((group, index) => (
                                    <div key={index} className="text-xs p-3 bg-muted rounded-md border">
                                        <div className="flex justify-between items-center mb-2 pb-2 border-b">
                                            <p className="font-bold text-sm">{format(group.date, 'dd MMMM yyyy', { locale: fr })}</p>
                                            <p className="text-sm text-muted-foreground">{group.kilometrage.toLocaleString()} km</p>
                                        </div>
                                        <div className="space-y-2">
                                            {group.events.map((event: Maintenance, eventIndex: number) => (
                                                <div key={eventIndex} className="flex justify-between items-start gap-2">
                                                    <div className="flex-1">
                                                        <p className="font-semibold">{event.typeIntervention}</p>
                                                        {event.description !== event.typeIntervention && <p className="text-muted-foreground">{event.description}</p>}
                                                    </div>
                                                    {event.cout != null && <div className="font-semibold text-right">{formatCurrency(event.cout, 'MAD')}</div>}
                                                </div>
                                            ))}
                                        </div>
                                        {group.totalCost > 0 && (
                                            <div className="flex justify-between items-center mt-2 pt-2 border-t font-bold">
                                                <p>Total</p>
                                                <p>{formatCurrency(group.totalCost, 'MAD')}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <Separator />
                <div>
                    <div className="font-bold text-lg"><strong>Prix par jour:</strong> {formatCurrency(car.prixParJour, 'MAD')}</div>
                </div>
            </div>
        </ScrollArea>
    );
}

export const PrintableCarDetails: React.FC<{ car: Car; history: any[] }> = ({ car, history }) => {
    const { companySettings } = useFirebase();
    const groupedMaintenanceHistory = history;
    const agencyName = companySettings?.companyName || "Location Auto Pro";

    return (
        <div id={`printable-details-${car.id}`} className="p-6 font-sans text-sm bg-white text-black">
            <header className="flex justify-between items-start pb-4 mb-6 border-b">
                <div className="flex items-center gap-4">
                    <Logo className="h-16 w-16" />
                    <div>
                        <h2 className="font-bold text-lg">{agencyName}</h2>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="font-bold text-xl">{car.marque} {car.modele}</h1>
                    <p className="font-mono">{car.immat}</p>
                </div>
            </header>
            <section className="mb-6">
                <h3 className="font-bold text-base mb-2 border-b pb-1">Informations Véhicule</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div><strong>Mise en circulation:</strong> {getSafeDate(car.dateMiseEnCirculation) ? format(getSafeDate(car.dateMiseEnCirculation)!, 'dd/MM/yyyy') : 'N/A'}</div>
                    <div><strong>Kilométrage:</strong> {car.kilometrage.toLocaleString()} km</div>
                    <div><strong>Carburant:</strong> {car.carburantType}</div>
                    <div><strong>Transmission:</strong> {car.transmission}</div>
                </div>
            </section>
            <section>
                <h3 className="font-bold text-base mb-2 border-b pb-1">Historique d'entretien</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Km</TableHead>
                            <TableHead>Intervention</TableHead>
                            <TableHead className="text-right">Coût</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedMaintenanceHistory.length > 0 ? groupedMaintenanceHistory.map((group, index) => (
                            <React.Fragment key={index}>
                                {group.events.map((event: Maintenance, eventIndex: number) => (
                                    <TableRow key={`${index}-${eventIndex}`}>
                                        <TableCell>{eventIndex === 0 ? format(group.date, 'dd/MM/yyyy') : ''}</TableCell>
                                        <TableCell>{eventIndex === 0 ? group.kilometrage.toLocaleString() : ''}</TableCell>
                                        <TableCell>{event.typeIntervention}</TableCell>
                                        <TableCell className="text-right">{event.cout != null ? formatCurrency(event.cout, 'MAD') : '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        )) : (
                            <TableRow><TableCell colSpan={4} className="text-center">Aucun historique.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </section>
        </div>
    );
};