"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Car, Maintenance } from "@/lib/definitions";
import { useFirebase } from "@/firebase";
import { arrayUnion, doc, serverTimestamp, updateDoc, FieldValue, runTransaction } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import React from "react";
import { maintenanceInterventionTypes } from "@/lib/car-data";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import { format } from 'date-fns';
import { getSafeDate } from "@/lib/utils";
import { Plus, Trash2, Construction, CheckCircle2 } from "lucide-react";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";

const eventSchema = z.object({
  typeIntervention: z.string().min(1, "Le type d'intervention est requis."),
  description: z.string().optional(),
  cout: z.coerce.number().min(0).optional().nullable(),
});

const startMaintenanceSchema = z.object({
  reason: z.string().min(3, "La raison est requise."),
  notes: z.string().optional(),
});

const finishMaintenanceSchema = z.object({
  date: z.coerce.date({ required_error: "La date est requise." }),
  kilometrage: z.coerce.number({ required_error: "Le kilométrage est requis." }).int().min(0, "Le kilométrage doit être positif."),
  maintenanceEvents: z.array(eventSchema).min(1, "Au moins une intervention est requise."),
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
        reason: "",
        notes: "",
        date: new Date(),
        kilometrage: car.kilometrage,
        maintenanceEvents: [{ typeIntervention: "", description: "", cout: null }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "maintenanceEvents",
  });
  
  React.useEffect(() => {
    if (isCurrentlyInMaintenance && car) {
        form.reset({
            date: getSafeDate(car.currentMaintenance?.startDate) || new Date(),
            kilometrage: car.kilometrage,
            maintenanceEvents: [{
                typeIntervention: car.currentMaintenance?.reason || "",
                description: car.currentMaintenance?.notes || "",
                cout: null,
            }]
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

            if (data.maintenanceEvents && data.maintenanceEvents.length > 0) {
                const newHistoryEvents: Maintenance[] = data.maintenanceEvents.map((event: any) => ({
                    date: data.date,
                    kilometrage: data.kilometrage,
                    typeIntervention: event.typeIntervention,
                    description: event.description || event.typeIntervention,
                    cout: event.cout ?? null,
                }));
                
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

                data.maintenanceEvents.forEach((event: { typeIntervention: string }) => {
                    const interventionType = event.typeIntervention.toLowerCase();
                    if (interventionType.includes("vidange")) {
                        newSchedule.prochainVidangeKm = newCarMileage + 10000;
                    }
                    if (interventionType.includes("filtre à carburant (gazole)")) {
                        newSchedule.prochainFiltreGasoilKm = newCarMileage + 20000;
                    }
                    if (interventionType.includes("plaquettes de frein")) {
                        newSchedule.prochainesPlaquettesFreinKm = newCarMileage + 20000;
                    }
                    if (interventionType.includes("distribution")) {
                        newSchedule.prochaineCourroieDistributionKm = newCarMileage + 60000;
                    }
                });
                updatePayload.maintenanceSchedule = newSchedule;
            }
        } else { // Starting maintenance (Immobilization)
            updatePayload.disponibilite = 'maintenance';
            updatePayload.currentMaintenance = {
                startDate: serverTimestamp(),
                reason: data.reason,
                notes: data.notes || ""
            };
        }

        transaction.update(carRef, updatePayload);
      });

      toast({ 
        title: isFinishing ? "Maintenance enregistrée" : "Voiture en maintenance", 
        description: isFinishing ? "Les interventions ont été ajoutées à l'historique." : "Le véhicule est maintenant marqué en maintenance." 
      });
      onFinished();
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: carRef.path,
            operation: 'update',
        }, serverError as Error));
        toast({
            variant: "destructive",
            title: "Une erreur est survenue",
            description: serverError.message || "Impossible de mettre à jour le statut du véhicule.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderInterventionFields = () => (
    <div className="space-y-4">
        {fields.map((item, index) => (
            <div key={item.id} className="p-4 border rounded-md relative bg-muted/20">
                <div className="flex justify-between items-center mb-4">
                    <h5 className="font-semibold text-sm">Intervention #{index + 1}</h5>
                    {fields.length > 1 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => remove(index)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <FormField
                    control={form.control}
                    name={`maintenanceEvents.${index}.typeIntervention`}
                    render={({ field }) => (
                    <FormItem className="mb-4">
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Object.entries(maintenanceInterventionTypes).map(([group, options]) => (
                                    <SelectGroup key={group}>
                                    <SelectLabel>{group}</SelectLabel>
                                    {options.map((option) => (
                                        <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name={`maintenanceEvents.${index}.description`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description (facultatif)</FormLabel>
                            <FormControl><Input placeholder="Détails..." {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`maintenanceEvents.${index}.cout`}
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Coût (MAD)</FormLabel>
                            <FormControl><Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>
        ))}
        <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={() => append({ typeIntervention: '', description: '', cout: null })}
        >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une intervention
        </Button>
    </div>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col space-y-4 pt-4">
        {isCurrentlyInMaintenance ? (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                <div className="p-3 border rounded-md bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-sm">
                    <p className="font-semibold text-yellow-800 dark:text-yellow-400">Véhicule immobilisé</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-500">
                        En maintenance depuis le {car.currentMaintenance?.startDate ? format(getSafeDate(car.currentMaintenance.startDate)!, 'dd/MM/yyyy') : 'N/A'}.<br/>
                        Raison : <strong>{car.currentMaintenance?.reason}</strong>
                    </p>
                </div>
                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date de fin</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "yyyy-MM-dd") : ""}
                                                onChange={(e) => field.onChange(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)}
                                            />
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
                                    <FormLabel>Km actuel</FormLabel>
                                    <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        <Separator />
                        <h4 className="font-bold text-sm">Interventions effectuées</h4>
                        {renderInterventionFields()}
                    </div>
                </ScrollArea>
            </div>
        ) : (
            <Tabs defaultValue="start" value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="start" className="flex items-center gap-2">
                        <Construction className="h-4 w-4" /> Immobiliser
                    </TabsTrigger>
                    <TabsTrigger value="direct_finish" className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Entretien fait
                    </TabsTrigger>
                </TabsList>
                
                <ScrollArea className="flex-1 pr-4">
                    <TabsContent value="start" className="mt-0 space-y-4">
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Motif de l'immobilisation</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {Object.entries(maintenanceInterventionTypes).map(([group, options]) => (
                                            <SelectGroup key={group}>
                                            <SelectLabel>{group}</SelectLabel>
                                            {options.map((option) => (
                                                <SelectItem key={option} value={option}>{option}</SelectItem>
                                            ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes (facultatif)</FormLabel>
                                <FormControl><Textarea placeholder="Précisions sur les travaux à prévoir..." {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </TabsContent>

                    <TabsContent value="direct_finish" className="mt-0 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "yyyy-MM-dd") : ""}
                                                onChange={(e) => field.onChange(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)}
                                            />
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
                                    <FormLabel>Kilométrage</FormLabel>
                                    <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        <Separator />
                        <h4 className="font-bold text-sm">Liste des interventions et prix</h4>
                        {renderInterventionFields()}
                    </TabsContent>
                </ScrollArea>
            </Tabs>
        )}

        <div className="pt-4 border-t mt-auto">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : 
                 (isCurrentlyInMaintenance ? 'Valider et libérer le véhicule' : 
                  (activeTab === 'start' ? 'Confirmer l\'immobilisation' : 'Enregistrer l\'entretien'))}
            </Button>
        </div>
      </form>
    </Form>
  );
}
