'use client';
import React from 'react';
import type { Payment, Rental } from '@/lib/definitions';
import { Logo } from '../logo';
import { formatCurrency, getSafeDate, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useFirebase } from '@/firebase';

type InvoiceProps = {
    rental: Rental;
    payments: Payment[];
    totalAmount: number;
};

export const Invoice: React.FC<InvoiceProps> = ({ rental, payments, totalAmount }) => {
    const { companySettings } = useFirebase();
    if (!rental) return null;
    
    const today = new Date();
    const debutDate = getSafeDate(rental.location.dateDebut);
    const finDate = getSafeDate(rental.location.dateFin);
    
    const safeDebutDate = debutDate ? format(debutDate, "dd/MM/yy 'à' HH:mm", { locale: fr }) : 'N/A';
    const safeFinDate = finDate ? format(finDate, "dd/MM/yy 'à' HH:mm", { locale: fr }) : 'N/A';

    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = Math.max(0, totalAmount - totalPaid);

    const agencyName = companySettings?.companyName || "Location Auto Pro";

    const numberToWords = (num: number) => {
        return `${num.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Dirhams`;
    };

    const amountInWords = numberToWords(totalAmount);

    return (
        <div id="printable-invoice" className="p-8 font-sans text-sm bg-white text-black min-h-[280mm] flex flex-col">
            <header className="flex justify-between items-start pb-8 border-b">
                <div className="flex items-center gap-4">
                    <Logo className="h-20 w-20" />
                    <div>
                        <h2 className="font-bold text-xl">{agencyName}</h2>
                        <p className="text-xs text-gray-600">
                            Rabat, Maroc<br/>
                            Tél: +212 537 00 00 00
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="font-bold text-3xl uppercase text-gray-800">Facture / Relevé</h1>
                    <p className="text-gray-600">Contrat N°: <span className="font-mono">{rental.contractNumber}</span></p>
                    <p className="text-gray-600">Date: {format(today, "dd/MM/yyyy", { locale: fr })}</p>
                </div>
            </header>

            <section className="my-10 grid grid-cols-2 gap-8">
                 <div>
                    <h3 className="font-semibold text-gray-800 mb-2">Facturé à :</h3>
                    <p className="text-lg font-medium">{rental.locataire.nomPrenom}</p>
                    <p>CIN: {rental.locataire.cin}</p>
                </div>
                <div className="text-right">
                    <h3 className="font-semibold text-gray-800 mb-2">Détails de la location :</h3>
                    <p>{rental.vehicule.marque} - {rental.vehicule.immatriculation}</p>
                    <p>Du {safeDebutDate} au {safeFinDate}</p>
                </div>
            </section>

            <section className="flex-grow">
                 <h3 className="font-semibold text-gray-800 mb-2">Historique des paiements :</h3>
                 {payments.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-100" style={{printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'}}>
                                <TableHead>Date et Heure</TableHead>
                                <TableHead>Méthode</TableHead>
                                <TableHead className="text-right">Montant</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.map(p => {
                                const pDate = getSafeDate(p.paymentDate);
                                return (
                                    <TableRow key={p.id}>
                                        <TableCell>{pDate ? format(pDate, "dd/MM/yyyy HH:mm", { locale: fr }) : 'N/A'}</TableCell>
                                        <TableCell>{p.paymentMethod}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(p.amount, 'MAD')}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                 ) : (
                    <div className="text-sm text-gray-500 py-4 text-center border rounded-md">Aucun paiement enregistré pour ce contrat.</div>
                 )}

                <div className="mt-8 flex justify-end">
                    <div className="w-full max-w-sm space-y-2">
                         <div className="flex justify-between">
                            <span>Total de la location :</span>
                            <span className="font-medium">{formatCurrency(totalAmount, 'MAD')}</span>
                        </div>
                         <div className="flex justify-between">
                            <span>Total payé :</span>
                            <span className="font-medium text-green-700">{formatCurrency(totalPaid, 'MAD')}</span>
                        </div>
                        <div className={cn("flex justify-between text-lg font-semibold py-2 border-t", balance > 0.01 ? "text-red-600" : "text-gray-500")}>
                            <span>Solde à payer :</span>
                            <span>{formatCurrency(balance, 'MAD')}</span>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="mt-auto pt-8 border-t text-sm text-gray-700">
                 <p className="mb-8">
                    Arrêtée la présente facture à la somme de : <span className="font-semibold">{amountInWords}</span>.
                </p>
                <div className="flex justify-between items-end">
                    <div className="text-center w-1/3">
                        <p className="pt-2">Cachet et Signature de l'agence</p>
                        <div className="mt-16 border-t border-gray-400"></div>
                    </div>
                </div>
                <div className="mt-12 text-center text-xs text-gray-500">
                    RC: 123456 | IF: 78901234 | ICE: 567890123456789
                </div>
            </footer>
        </div>
    );
};