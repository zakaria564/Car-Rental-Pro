
'use client';

import React from 'react';
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
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
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div><strong>Marque:</strong> {car.marque}</div>
                    <div><strong>Modèle:</strong> {car.modele}</div>
                    <div><strong>Mise en circulation:</strong> {getSafeDate(car.dateMiseEnCirculation) ? format(getSafeDate(car.dateMiseEnCirculation)!, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}</div>
                    <div><strong>Immatriculation:</strong> {car.immat}</div>
                    {car.immatWW && <div><strong>Immatriculation WW:</strong> {car.immatWW}</div>}
                    <div><strong>N° de châssis:</strong> {car.numChassis}</div>
                    <div><strong>Couleur:</strong> {car.couleur}</div>
                    <div><strong>Kilométrage:</strong> {car.kilometrage.toLocaleString()} km</div>
                    <div><strong>Carburant:</strong> {car.carburantType}</div>
                    <div><strong>Transmission:</strong> {car.transmission}</div>
                    <div><strong>Puissance:</strong> {car.puissance} cv</div>
                    <div><strong>Places:</strong> {car.nbrPlaces}</div>
                    <div><strong>État:</strong> {car.etat}</div>
                     {!isArchived && <div className="flex items-center gap-2"><strong>Disponibilité:</strong> <Badge variant="default" className={cn(availability.className, 'text-white')}>{availability.text}</Badge></div>}
                </div>
                 {car.disponibilite === 'maintenance' && car.currentMaintenance && (
                    <div className="col-span-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">
                        <p className="font-semibold text-yellow-800">Détails de la maintenance en cours:</p>
                        <p><strong>Depuis le:</strong> {getSafeDate(car.currentMaintenance.startDate) ? format(getSafeDate(car.currentMaintenance.startDate)!, 'dd/MM/yyyy') : 'N/A'}</p>
                        <p><strong>Raison:</strong> {car.currentMaintenance.reason}</p>
                        {car.currentMaintenance.notes && <p><strong>Notes:</strong> {car.currentMaintenance.notes}</p>}
                    </div>
                )}
                <Separator />
                 <div className="space-y-2">
                    <h4 className="font-semibold text-base">Documents &amp; Expirations</h4>
                    <div className="flex items-center gap-2">
                        <strong>Expiration Assurance:</strong> {assuranceDate ? format(assuranceDate, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                        {isAssuranceExpired && <Badge variant="destructive">Expirée</Badge>}
                        {isAssuranceExpiringSoon && <Badge className="bg-accent text-accent-foreground hover:bg-accent/80">Expire bientôt</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                        <strong>Prochaine Visite:</strong> {visiteDate ? format(visiteDate, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                        {isVisiteExpired && <Badge variant="destructive">Expirée</Badge>}
                        {isVisiteExpiringSoon && <Badge className="bg-accent text-accent-foreground hover:bg-accent/80">Expire bientôt</Badge>}
                    </div>
                    <div><strong>Vignette:</strong> {car.anneeVignette || 'N/A'}</div>
                </div>
                 {car.maintenanceSchedule && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <h4 className="font-semibold text-base">Plan d'Entretien</h4>
                            {car.maintenanceSchedule.prochainVidangeKm && <div><strong>Prochaine Vidange:</strong> {car.maintenanceSchedule.prochainVidangeKm.toLocaleString()} km</div>}
                            {car.maintenanceSchedule.prochainFiltreGasoilKm && <div><strong>Prochain Filtre Gazole:</strong> {car.maintenanceSchedule.prochainFiltreGasoilKm.toLocaleString()} km</div>}
                            {car.maintenanceSchedule.prochainesPlaquettesFreinKm && <div><strong>Prochaines Plaquettes:</strong> {car.maintenanceSchedule.prochainesPlaquettesFreinKm.toLocaleString()} km</div>}
                            {car.maintenanceSchedule.prochaineCourroieDistributionKm && <div><strong>Prochaine Distribution:</strong> {car.maintenanceSchedule.prochaineCourroieDistributionKm.toLocaleString()} km</div>}
                        </div>
                    </>
                )}
                
                {groupedMaintenanceHistory.length > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-3">
                           <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-base">Historique d'entretien</h4>
                                <div className="flex items-center gap-2">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant={"outline"}
                                        className={cn(
                                          "w-[240px] justify-start text-left font-normal h-8",
                                          !historyFilterDate && "text-muted-foreground"
                                        )}
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {historyFilterDate ? format(historyFilterDate, "dd MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                      <Calendar
                                        mode="single"
                                        selected={historyFilterDate}
                                        onSelect={setHistoryFilterDate}
                                        initialFocus
                                        locale={fr}
                                        captionLayout="dropdown-nav"
                                        fromYear={new Date().getFullYear() - 10}
                                        toYear={new Date().getFullYear()}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                  {historyFilterDate && (
                                    <Button variant="ghost" size="sm" onClick={() => setHistoryFilterDate(undefined)}>
                                        Effacer
                                    </Button>
                                  )}
                                </div>
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
                                {filteredHistory.length === 0 && (
                                    <p className="text-center text-muted-foreground py-4">Aucune intervention ne correspond à votre recherche.</p>
                                )}
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
    const groupedMaintenanceHistory = history;

    const PrintableHeader = ({ isIntervention }: { isIntervention: boolean }) => (
        <header className="flex justify-between items-start pb-4 mb-4 border-b">
            <div className="flex items-center gap-4">
                <Logo />
                <div>
                    <h2 className="font-bold text-lg">Location Auto Pro</h2>
                    <p className="text-xs text-gray-600">{isIntervention ? "Fiche d'intervention" : "Fiche de suivi du véhicule"}</p>
                </div>
            </div>
            <div className="text-right">
                <h1 className="font-bold text-xl">{car.marque} {car.modele}</h1>
                <p className="font-mono text-base">{car.immat}</p>
            </div>
        </header>
    );
    
    const VehicleInfo = () => (
      <>
        <section className="mb-4">
            <h3 className="font-bold text-base mb-2 border-b pb-1">Informations Générales</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <div><strong>Mise en circulation:</strong> {getSafeDate(car.dateMiseEnCirculation) ? format(getSafeDate(car.dateMiseEnCirculation)!, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}</div>
                <div><strong>N° de châssis:</strong> {car.numChassis}</div>
                <div><strong>Couleur:</strong> {car.couleur}</div>
                <div><strong>Kilométrage Actuel:</strong> {car.kilometrage.toLocaleString()} km</div>
                <div><strong>Carburant:</strong> {car.carburantType}</div>
                <div><strong>Transmission:</strong> {car.transmission}</div>
                <div><strong>Puissance:</strong> {car.puissance} cv</div>
                <div><strong>Places:</strong> {car.nbrPlaces}</div>
            </div>
        </section>
        <section className="mb-4">
            <h3 className="font-bold text-base mb-2 border-b pb-1">Documents &amp; Plan d'Entretien</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <div><strong>Expiration Assurance:</strong> {getSafeDate(car.dateExpirationAssurance) ? format(getSafeDate(car.dateExpirationAssurance)!, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}</div>
                <div><strong>Prochaine Visite:</strong> {getSafeDate(car.dateProchaineVisiteTechnique) ? format(getSafeDate(car.dateProchaineVisiteTechnique)!, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}</div>
                {car.maintenanceSchedule?.prochainVidangeKm && <div><strong>Prochaine Vidange:</strong> {car.maintenanceSchedule.prochainVidangeKm.toLocaleString()} km</div>}
                {car.maintenanceSchedule?.prochainFiltreGasoilKm && <div><strong>Prochain Filtre Gazole:</strong> {car.maintenanceSchedule.prochainFiltreGasoilKm.toLocaleString()} km</div>}
                {car.maintenanceSchedule?.prochainesPlaquettesFreinKm && <div><strong>Prochaines Plaquettes:</strong> {car.maintenanceSchedule.prochainesPlaquettesFreinKm.toLocaleString()} km</div>}
                {car.maintenanceSchedule?.prochaineCourroieDistributionKm && <div><strong>Prochaine Distribution:</strong> {car.maintenanceSchedule.prochaineCourroieDistributionKm.toLocaleString()} km</div>}
            </div>
        </section>
      </>
    );

    return (
        <div id={`printable-details-${car.id}`} className="font-sans text-sm bg-white text-black">
            {groupedMaintenanceHistory.length > 0 ? (
                <>
                    {groupedMaintenanceHistory.map((group, index) => (
                        <div key={index} className="p-1 printable-group">
                            <PrintableHeader isIntervention={true} />
                            <VehicleInfo />
                             <section>
                                <h3 className="font-bold text-base mb-2 border-b pb-1">
                                    Interventions du {format(group.date, "dd MMMM yyyy", { locale: fr })}
                                    <span className="float-right font-normal">{group.kilometrage.toLocaleString()} km</span>
                                </h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40%]">Intervention</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right w-[20%]">Coût</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.events.map((event: Maintenance, eventIndex: number) => (
                                            <TableRow key={eventIndex}>
                                                <TableCell className="font-medium">{event.typeIntervention}</TableCell>
                                                <TableCell>{event.description}</TableCell>
                                                <TableCell className="text-right">{event.cout != null ? formatCurrency(event.cout, 'MAD') : '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {group.totalCost > 0 && (
                                            <TableRow className="bg-gray-100 font-bold" style={{printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'}}>
                                                <TableCell colSpan={2} className="text-right">Total des interventions</TableCell>
                                                <TableCell className="text-right">{formatCurrency(group.totalCost, 'MAD')}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </section>
                        </div>
                    ))}
                </>
            ) : (
                <div className="p-1">
                    <PrintableHeader isIntervention={false} />
                    <VehicleInfo />
                    <section>
                        <h3 className="font-bold text-base mb-2 border-b pb-1">Historique d'entretien</h3>
                        <p className="text-sm text-gray-500 py-4 text-center">Aucun historique d'entretien enregistré.</p>
                    </section>
                </div>
            )}
        </div>
    );
};
