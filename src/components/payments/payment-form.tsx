"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Payment, Rental } from "@/lib/definitions";
import { useFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, runTransaction } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import React from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { ScrollArea } from "../ui/scroll-area";

const paymentFormSchema = z.object({
  rentalId: z.string().min(1, "Veuillez sélectionner un contrat de location."),
  amount: z.coerce.number().positive("Le montant doit être un nombre positif."),
  paymentDate: z.coerce.date({ required_error: "La date de paiement est requise." }),
  paymentMethod: z.enum(["Especes", "Carte bancaire", "Virement", "Avance"], { required_error: "La méthode de paiement est requise." }),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;


const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (date.toDate) return date.toDate(); // Firestore Timestamp
    if (date instanceof Date) return date;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const calculateTotal = (rental: Rental): number => {
    const from = getSafeDate(rental.location.dateDebut);
    const to = getSafeDate(rental.location.dateFin);
    const pricePerDay = rental.location.prixParJour || 0;

    if (from && to && pricePerDay > 0) {
        if (startOfDay(from).getTime() === startOfDay(to).getTime()) {
            return pricePerDay;
        }
        const daysDiff = differenceInCalendarDays(to, from);
        return daysDiff * pricePerDay;
    }

    // Fallbacks
    if (typeof rental.location.montantTotal === 'number' && !isNaN(rental.location.montantTotal) && rental.location.montantTotal > 0) {
      return rental.location.montantTotal;
    }
    if (rental.location.nbrJours && pricePerDay > 0) {
      return rental.location.nbrJours * pricePerDay;
    }
    
    return 0;
  };


export default function PaymentForm({ payment, rentals, onFinished, preselectedRentalId }: { 
    payment: Payment | null, 
    rentals: Rental[], 
    onFinished: () => void,
    preselectedRentalId?: string | null
}) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: "onChange",
  });

  React.useEffect(() => {
    if (payment) {
        form.reset({
            ...payment,
            paymentDate: getSafeDate(payment.paymentDate) ?? new Date(),
        });
        return;
    }

    let defaultAmount: number | undefined = undefined;
    if (preselectedRentalId) {
        const selectedRental = rentals.find(r => r.id === preselectedRentalId);
        if (selectedRental) {
            const total = calculateTotal(selectedRental);
            const paid = selectedRental.location.montantPaye || 0;
            const remaining = total - paid;
            if (remaining > 0) {
                defaultAmount = remaining;
            }
        }
    }

    form.reset({
        rentalId: preselectedRentalId || "",
        amount: defaultAmount,
        paymentDate: new Date(),
        paymentMethod: "Especes" as const,
    });
  }, [payment, preselectedRentalId, rentals, form]);

  const selectedRentalId = form.watch("rentalId");
  const selectedRental = React.useMemo(() => {
    return rentals.find(r => r.id === selectedRentalId);
  }, [selectedRentalId, rentals]);

  const financialSummary = React.useMemo(() => {
    if (!selectedRental) return { total: 0, paye: 0, reste: 0, formattedReste: "" };
    
    const total = calculateTotal(selectedRental);
    const paye = selectedRental.location.montantPaye || 0;
    const reste = total - paye;

    return { total, paye, reste, formattedReste: formatCurrency(reste, 'MAD') };
  }, [selectedRental]);

  async function onSubmit(data: PaymentFormValues) {
    if (!firestore || !selectedRental) return;
    
    const isNewPayment = !payment;

    if (isNewPayment) {
        if (financialSummary.reste <= 0.01) { // Use a small epsilon
            form.setError("rentalId", {
                type: "manual",
                message: "Ce contrat est déjà entièrement payé.",
            });
            return;
        }

        if (data.amount > financialSummary.reste + 0.01) { // Use a small epsilon
            form.setError("amount", {
                type: "manual",
                message: `Le montant ne peut pas dépasser le reste à payer de ${financialSummary.formattedReste}.`,
            });
            return;
        }
    }

    setIsSubmitting(true);

    const paymentId = payment?.id || doc(collection(firestore, 'payments')).id;
    const rentalRef = doc(firestore, 'rentals', selectedRental.id);
    const paymentRef = doc(firestore, 'payments', paymentId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const rentalDoc = await transaction.get(rentalRef);
            if (!rentalDoc.exists()) {
                throw "Contrat de location introuvable.";
            }

            const currentRentalData = rentalDoc.data() as Rental;
            const currentPaidAmount = currentRentalData.location.montantPaye || 0;
            const newPaidAmount = currentPaidAmount + data.amount;

            const paymentPayload = {
              ...data,
              clientName: selectedRental.locataire.nomPrenom,
              contractNumber: selectedRental.contractNumber,
              status: "complete" as const,
            };
            
            transaction.set(paymentRef, paymentPayload, { merge: !isNewPayment });
            
            if (isNewPayment) {
              const archivedPaymentRef = doc(firestore, 'archived_payments', paymentId);
              transaction.set(archivedPaymentRef, paymentPayload);
            }

            transaction.update(rentalRef, { 'location.montantPaye': newPaidAmount });
        });

        toast({
          title: isNewPayment ? "Paiement ajouté" : "Paiement mis à jour",
          description: `Le paiement de ${formatCurrency(data.amount, 'MAD')} a été enregistré.`,
        });
        onFinished();
    } catch (error) {
        console.error("Erreur de transaction:", error);
        errorEmitter.emit('permission-error', new Error("Une erreur de permission ou de transaction est survenue."));
        toast({
          variant: "destructive",
          title: "Une erreur est survenue",
          description: typeof error === 'string' ? error : "Impossible de sauvegarder le paiement. Vérifiez vos permissions et réessayez.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-grow mt-4 overflow-hidden">
        <ScrollArea className="flex-grow pr-6 -mr-6">
            <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="rentalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contrat de location</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={!!payment}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un contrat" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rentals.map(rental => (
                            <SelectItem key={rental.id} value={rental.id}>
                              {rental.locataire.nomPrenom} - {rental.vehicule.marque} ({rental.contractNumber})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedRental && (
                        <div className="mt-2 text-sm p-3 bg-muted rounded-md border">
                            <p className="font-semibold mb-2">Résumé Financier du Contrat</p>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>Total du contrat:</span>
                                    <span className="font-medium">{formatCurrency(financialSummary.total, 'MAD')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Montant déjà payé:</span>
                                    <span className="font-medium text-green-600">{formatCurrency(financialSummary.paye, 'MAD')}</span>
                                </div>
                                 <div className="flex justify-between border-t mt-2 pt-2">
                                    <span className="font-semibold">Reste à payer:</span>
                                    <span className="font-semibold text-destructive">{financialSummary.formattedReste}</span>
                                </div>
                            </div>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant (MAD)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="300" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date du paiement</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value instanceof Date && !isNaN(field.value) ? format(field.value, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                                const dateString = e.target.value;
                                if (!dateString) {
                                    field.onChange(null);
                                } else {
                                    field.onChange(new Date(`${dateString}T00:00:00`));
                                }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Méthode de paiement</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une méthode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Especes">Espèces</SelectItem>
                          <SelectItem value="Carte bancaire">Carte bancaire</SelectItem>
                          <SelectItem value="Virement">Virement</SelectItem>
                          <SelectItem value="Avance">Avance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
        </ScrollArea>
        <div className="mt-auto flex-shrink-0 pt-4 border-t">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : (payment ? 'Mettre à jour' : 'Ajouter le paiement')}
            </Button>
        </div>
      </form>
    </Form>
  );
}
