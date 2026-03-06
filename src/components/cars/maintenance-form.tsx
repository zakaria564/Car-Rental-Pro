"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Car, Maintenance } from "@/lib/definitions";
import { useFirebase } from "@/firebase";
import { arrayUnion, doc, serverTimestamp, runTransaction } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import React from "react";
import { maintenanceInterventionTypes } from "@/lib/car-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { format } from 'date-fns';
import { getSafeDate } from "@/lib/utils";
import { Construction, CheckCircle2, Wrench, Paintbrush } from "lucide-react";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";

const startMaintenanceSchema = z.object({
  mechanicalReason: z.string().optional(),
  bodyworkReason: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => data.mechanicalReason || data.bodyworkReason, {
    message: "Veuillez sélectionner au moins un motif.",
    path: ["mechanicalReason"]
});

const finishMaintenanceSchema = z.object({
  date: z.coerce.date({ required_error: "La date est requise." }),
  kilometrage: z.coerce.number({ required_error: "Le kilométrage est requis." }).int().min(0, "Le kilométrage doit être positif."),
  prices: z.record(z.string(), z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().min(0).optional())),
  otherIntervention: z.string().optional(),
  otherPrice: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number().min(0).optional()),
});

export default function MaintenanceForm({ car, onFinished }: { car: Car, onFinished: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<string>("start");
  
  const isCurrentlyInMaintenance = car.disponibilite === 'maintenance';

  const form = useForm({
    resolver: zodResolver(activeTab === "direct_finish" || isCurrentlyInMaintenance ? finishMaintenanceSchema : startMaintenanceSchema),
    defaultValues: {
        mechanicalReason: "",
        bodyworkReason: "",
        notes: "",
        date: new Date(),
        kilometrage: car.kilometrage,
        prices: {},
        otherIntervention: "",
        otherPrice: undefined
    }
  });

  React.useEffect(() => {
    if (isCurrentlyInMaintenance && car) {
        form.reset({
            date: new Date(),
            kilometrage: car.kilometrage,
            prices: {},
            notes: car.currentMaintenance?.notes || ""
        });
    }
  }, [car, isCurrentlyInMaintenance, form]);

  const onSubmit = async (data: any) => {
    if (!firestore) return;
    setIsSubmitting(true);
    
    const carRef = doc(firestore, 'cars', car.id);
    const isFinishing = isCurrentlyInMaintenance || activeTab === "direct_finish";

    try {
      await runTransaction(firestore, async (transaction) => {
        const carDoc = await transaction.get(carRef);
        if (!carDoc.exists()) {
          throw new Error("Véhicule introuvable.");
        }
        
        const carData = carDoc.data() as Car;
        const updatePayload: {[key: string]: any} = {};

        if (isFinishing) {
            updatePayload.disponibilite = 'disponible';
            updatePayload.currentMaintenance = null;

            const newHistoryEvents: Maintenance[] = [];
            
            // Collect prices from fixed fields
            if (data.prices) {
                Object.entries(data.prices).forEach(([type, price]) => {
                    if (price && Number(price) > 0) {
                        newHistoryEvents.push({
                            date: data.date,
                            kilometrage: data.kilometrage,
                            typeIntervention: type,
                            description: type,
                            cout: Number(price),
                        });
                    }
                });
            }

            // Collect other intervention
            if (data.otherIntervention && data.otherPrice) {
                newHistoryEvents.push({
                    date: data.date,
                    kilometrage: data.kilometrage,
                    typeIntervention: data.otherIntervention,
                    description: data.otherIntervention,
                    cout: Number(data.otherPrice),
                });
            }

            if (newHistoryEvents.length > 0) {
                const existingHistory = carData.maintenanceHistory || [];
                const nonDuplicateEvents = newHistoryEvents.filter(newEvent => 
                    !existingHistory.some(existingEvent => 
                        getSafeDate(existingEvent.date)?.getTime() === getSafeDate(newEvent.date)?.getTime() &&
                        existingEvent.typeIntervention === newEvent.typeIntervention &&
                        existingEvent.kilometrage === newEvent.kilometrage
                    )
                );

                if (nonDuplicateEvents.length > 0) {
                    updatePayload.maintenanceHistory = arrayUnion(...nonDuplicateEvents);
                }

                const newCarMileage = Math.max(carData.kilometrage, data.kilometrage);
                updatePayload.kilometrage = newCarMileage;
                
                const newSchedule = { ...(carData.maintenanceSchedule || {}) };

                newHistoryEvents.forEach((event) => {
                    const type = event.typeIntervention.toLowerCase();
                    if (type.includes("vidange")) newSchedule.prochainVidangeKm = newCarMileage + 10000;
                    if (type.includes("filtre à carburant (gazole)")) newSchedule.prochainFiltreGasoilKm = newCarMileage + 20000;
                    if (type.includes("plaquettes")) newSchedule.prochainesPlaquettesFreinKm = newCarMileage + 20000;
                    if (type.includes("distribution")) newSchedule.prochaineCourroieDistributionKm = newCarMileage + 60000;
                });
                updatePayload.maintenanceSchedule = newSchedule;
            }
        } else { 
            updatePayload.disponibilite = 'maintenance';
            const reason = [data.mechanicalReason, data.bodyworkReason].filter(Boolean).join(' + ');
            updatePayload.currentMaintenance = {
                startDate: serverTimestamp(),
                reason: reason,
                notes: data.notes || ""
            };
        }

        transaction.update(carRef, updatePayload);
      });

      toast({ 
        title: isFinishing ? "Entretien enregistré" : "Véhicule immobilisé", 
        description: isFinishing ? "L'historique a été mis à jour." : "Le véhicule est maintenant en maintenance." 
      });
      onFinished();
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: carRef.path,
            operation: 'update',
        }, serverError as Error));
        toast({
            variant: "destructive",
            title: "Erreur",
            description: serverError.message || "Impossible de mettre à jour le véhicule.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col space-y-4 pt-4">
        {isCurrentlyInMaintenance ? (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                <div className="p-3 border rounded-md bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-sm">
                    <p className="font-semibold text-yellow-800">Véhicule immobilisé</p>
                    <p className="text-xs text-yellow-700">
                        En maintenance pour : <strong>{car.currentMaintenance?.reason}</strong>
                    </p>
                </div>
                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date de fin</FormLabel>
                                        <FormControl>
                                            <Input type="date" value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd") : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="kilometrage"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kilométrage actuel</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        
                        <div className="space-y-6">
                            <section>
                                <div className="flex items-center gap-2 mb-4 text-primary font-bold">
                                    <Wrench className="h-4 w-4" />
                                    <h4>PARTIE MÉCANIQUE</h4>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {maintenanceInterventionTypes["Mécanique"].map((type) => (
                                        <FormField
                                            key={type}
                                            control={form.control}
                                            name={`prices.${type}`}
                                            render={({ field }) => (
                                                <div className="flex items-center justify-between gap-4 py-1 border-b border-muted">
                                                    <span className="text-xs font-medium flex-1">{type}</span>
                                                    <Input type="number" placeholder="Prix MAD" className="w-24 h-8 text-xs" {...field} value={field.value ?? ''} />
                                                </div>
                                            )}
                                        />
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-2 mb-4 text-orange-600 font-bold">
                                    <Paintbrush className="h-4 w-4" />
                                    <h4>PARTIE CARROSSERIE</h4>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {maintenanceInterventionTypes["Carrosserie"].map((type) => (
                                        <FormField
                                            key={type}
                                            control={form.control}
                                            name={`prices.${type}`}
                                            render={({ field }) => (
                                                <div className="flex items-center justify-between gap-4 py-1 border-b border-muted">
                                                    <span className="text-xs font-medium flex-1">{type}</span>
                                                    <Input type="number" placeholder="Prix MAD" className="w-24 h-8 text-xs" {...field} value={field.value ?? ''} />
                                                </div>
                                            )}
                                        />
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        ) : (
            <Tabs defaultValue="start" value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="start">Immobiliser</TabsTrigger>
                    <TabsTrigger value="direct_finish">Enregistrement direct</TabsTrigger>
                </TabsList>
                
                <ScrollArea className="flex-1 pr-4">
                    <TabsContent value="start" className="mt-0 space-y-6">
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="mechanicalReason"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-primary font-bold">Motif Mécanique (si concerné)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Choisir une intervention mécanique..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {maintenanceInterventionTypes["Mécanique"].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bodyworkReason"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-orange-600 font-bold">Motif Carrosserie (si concerné)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Choisir une intervention carrosserie..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {maintenanceInterventionTypes["Carrosserie"].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes supplémentaires</FormLabel>
                                    <FormControl><Textarea placeholder="Précisions..." {...field} /></FormControl>
                                </FormItem>
                                )}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="direct_finish" className="mt-0 space-y-6">
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd") : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="kilometrage"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kilométrage</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-8">
                            <section>
                                <div className="flex items-center gap-2 mb-4 text-primary font-bold border-b pb-2">
                                    <Wrench className="h-4 w-4" />
                                    <h4>PARTIE MÉCANIQUE</h4>
                                </div>
                                <div className="space-y-2">
                                    {maintenanceInterventionTypes["Mécanique"].map((type) => (
                                        <FormField
                                            key={type}
                                            control={form.control}
                                            name={`prices.${type}`}
                                            render={({ field }) => (
                                                <div className="flex items-center justify-between gap-4 py-1.5 hover:bg-muted/30 px-1 rounded transition-colors border-b border-muted/50">
                                                    <span className="text-[11px] font-medium flex-1">{type}</span>
                                                    <Input type="number" placeholder="Prix" className="w-20 h-7 text-[11px]" {...field} value={field.value ?? ''} />
                                                </div>
                                            )}
                                        />
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-2 mb-4 text-orange-600 font-bold border-b pb-2">
                                    <Paintbrush className="h-4 w-4" />
                                    <h4>PARTIE CARROSSERIE</h4>
                                </div>
                                <div className="space-y-2">
                                    {maintenanceInterventionTypes["Carrosserie"].map((type) => (
                                        <FormField
                                            key={type}
                                            control={form.control}
                                            name={`prices.${type}`}
                                            render={({ field }) => (
                                                <div className="flex items-center justify-between gap-4 py-1.5 hover:bg-muted/30 px-1 rounded transition-colors border-b border-muted/50">
                                                    <span className="text-[11px] font-medium flex-1">{type}</span>
                                                    <Input type="number" placeholder="Prix" className="w-20 h-7 text-[11px]" {...field} value={field.value ?? ''} />
                                                </div>
                                            )}
                                        />
                                    ))}
                                </div>
                            </section>

                            <section className="bg-muted/20 p-3 rounded-md border border-dashed">
                                <FormLabel className="text-xs font-bold mb-3 block">AUTRE INTERVENTION</FormLabel>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="otherIntervention"
                                        render={({ field }) => <Input placeholder="Nom de l'intervention..." className="h-8 text-xs" {...field} />}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="otherPrice"
                                        render={({ field }) => <Input type="number" placeholder="Prix MAD" className="h-8 text-xs" {...field} value={field.value ?? ''} />}
                                    />
                                </div>
                            </section>
                        </div>
                    </TabsContent>
                </ScrollArea>
            </Tabs>
        )}

        <div className="pt-4 border-t mt-auto">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : (isCurrentlyInMaintenance ? 'Valider et libérer' : (activeTab === 'start' ? 'Confirmer l\'immobilisation' : 'Enregistrer les travaux'))}
            </Button>
        </div>
      </form>
    </Form>
  );
}
