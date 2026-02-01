
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
import { Plus, Trash2 } from "lucide-react";
import { Separator } from "../ui/separator";

const startMaintenanceSchema = z.object({
  reason: z.string().min(3, "La raison est requise."),
  notes: z.string().optional(),
});

const finishMaintenanceSchema = z.object({
  date: z.coerce.date({ required_error: "La date est requise." }),
  kilometrage: z.coerce.number({ required_error: "Le kilométrage est requis." }).int().min(0, "Le kilométrage doit être positif."),
  
  maintenanceEvents: z.array(z.object({
    typeIntervention: z.string().min(1, "Le type d'intervention est requis."),
    description: z.string().optional(),
    cout: z.coerce.number().min(0).optional().nullable(),
  })).min(1, "Au moins une intervention est requise."),
});


export default function MaintenanceForm({ car, onFinished }: { car: Car, onFinished: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const isFinishing = car.disponibilite === 'maintenance';

  const form = useForm({
    resolver: zodResolver(isFinishing ? finishMaintenanceSchema : startMaintenanceSchema),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "maintenanceEvents",
  });
  
  React.useEffect(() => {
    if (isFinishing && car) {
        form.reset({
            date: getSafeDate(car.currentMaintenance?.startDate) || new Date(),
            kilometrage: car.kilometrage,
            maintenanceEvents: [{
                typeIntervention: car.currentMaintenance?.reason || "",
                description: car.currentMaintenance?.notes || "",
                cout: undefined,
            }]
        });
    } else {
        form.reset({
          reason: "",
          notes: ""
        });
    }
  }, [car, isFinishing, form]);

  const onSubmit = async (data: any) => {
    if (!firestore) return;
    setIsSubmitting(true);
    
    const carRef = doc(firestore, 'cars', car.id);

    try {
      await runTransaction(firestore, async (transaction) => {
        const carDoc = await transaction.get(carRef);
        if (!carDoc.exists()) {
          throw new Error("Car document not found.");
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
                
                const calculateNext = (currentKm: number, interval: number): number | null => {
                    if (interval <= 0) return null;
                    const next = Math.ceil(currentKm / interval) * interval;
                    return next > currentKm ? next : next + interval;
                };

                updatePayload.maintenanceSchedule = {
                    prochainVidangeKm: calculateNext(newCarMileage, 10000),
                    prochainFiltreGasoilKm: calculateNext(newCarMileage, 20000),
                    prochainesPlaquettesFreinKm: calculateNext(newCarMileage, 20000),
                    prochaineCourroieDistributionKm: calculateNext(newCarMileage, 60000),
                };
            }
        } else { // Starting maintenance
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
        title: isFinishing ? "Maintenance terminée" : "Voiture en maintenance", 
        description: isFinishing ? "La voiture est de nouveau marquée comme disponible." : "Le statut de la voiture a été mis à jour." 
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
            description: serverError.message || "Impossible de mettre à jour le statut de la voiture.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        {isFinishing ? (
            <div className="space-y-4">
                <div className="p-4 border rounded-md bg-muted/50">
                    <h4 className="font-semibold">Terminer la maintenance</h4>
                    <p className="text-sm text-muted-foreground">
                        La voiture est en maintenance depuis le {car.currentMaintenance?.startDate ? format(getSafeDate(car.currentMaintenance.startDate)!, 'dd/MM/yyyy') : 'N/A'}.<br/>
                        Raison initiale: <strong>{car.currentMaintenance?.reason}</strong>
                    </p>
                </div>
                 <div className="p-4 border rounded-md space-y-4">
                    <h4 className="font-semibold">Détails de l'intervention</h4>
                     <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Date de l'intervention</FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""}
                                        onChange={(e) => {
                                            const dateString = e.target.value;
                                            if (!dateString) field.onChange(null);
                                            else field.onChange(new Date(`${dateString}T00:00:00`));
                                        }}
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
                            <FormLabel>Kilométrage actuel</FormLabel>
                            <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                 <div className="space-y-4">
                    {fields.map((item, index) => (
                        <div key={item.id} className="p-4 border rounded-md relative">
                            <h5 className="font-medium mb-4">Intervention #{index + 1}</h5>
                             <FormField
                                control={form.control}
                                name={`maintenanceEvents.${index}.typeIntervention`}
                                render={({ field }) => (
                                <FormItem className="mb-4">
                                    <FormLabel>Type d'intervention</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
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
                                name={`maintenanceEvents.${index}.description`}
                                render={({ field }) => (
                                <FormItem className="mb-4">
                                    <FormLabel>Description</FormLabel>
                                    <FormControl><Textarea placeholder="Ex: Remplacement des pièces..." {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`maintenanceEvents.${index}.cout`}
                                render={({ field }) => (
                                <FormItem className="mb-4">
                                    <FormLabel>Coût (MAD)</FormLabel>
                                    <FormControl><Input type="number" placeholder="350.00" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            {fields.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 text-destructive"
                                    onClick={() => remove(index)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                     <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => append({ typeIntervention: '', description: '', cout: undefined })}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter une autre intervention
                    </Button>
                </div>
            </div>
        ) : (
            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Raison de la maintenance</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner un type d'intervention" /></SelectTrigger>
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
                        <FormLabel>Notes supplémentaires</FormLabel>
                        <FormControl><Textarea placeholder="Symptômes observés, détails spécifiques..." {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
        )}

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
          {isSubmitting ? 'Enregistrement...' : (isFinishing ? 'Terminer la maintenance' : 'Mettre en maintenance')}
        </Button>
      </form>
    </Form>
  );
}

    
