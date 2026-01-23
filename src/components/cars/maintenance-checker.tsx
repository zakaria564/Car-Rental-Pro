
"use client";
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { checkMaintenance, type MaintenanceState } from '@/lib/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import type { Car } from '@/lib/definitions';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full bg-primary hover:bg-primary/90">
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
            Prédire l'entretien
        </Button>
    );
}

export default function MaintenanceChecker({ car }: { car: Car }) {
    const initialState: MaintenanceState = { message: null, errors: {} };
    const [state, dispatch] = useActionState(checkMaintenance, initialState);

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Utilisez notre outil alimenté par l'IA pour prédire si cette voiture a besoin d'un entretien en fonction de son utilisation récente et de son historique.
            </p>
            <form action={dispatch} className="space-y-4">
                <input type="hidden" name="carId" value={car.id} />
                <div className="space-y-2">
                    <Label htmlFor="usageData">Données d'utilisation récentes</Label>
                    <Textarea
                        id="usageData"
                        name="usageData"
                        placeholder="par exemple, 'Conduite de 2000 miles le mois dernier, principalement en ville. Quelques freinages brusques.'"
                        required
                    />
                    {state.errors?.usageData && <p className="text-sm font-medium text-destructive">{state.errors.usageData[0]}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="historicalMaintenanceData">Données d'entretien historiques</Label>
                    <Textarea
                        id="historicalMaintenanceData"
                        name="historicalMaintenanceData"
                        placeholder="L'historique d'entretien de la voiture sera utilisé. Vous pouvez ajouter des détails supplémentaires ici si nécessaire."
                        required
                        defaultValue={car.maintenanceHistory || ""}
                    />
                     {state.errors?.historicalMaintenanceData && <p className="text-sm font-medium text-destructive">{state.errors.historicalMaintenanceData[0]}</p>}
                </div>
                <SubmitButton />
            </form>

            {state.message === 'Success' && state.data && (
                <Alert variant={state.data.needsMaintenance ? 'destructive' : 'default'} className={!state.data.needsMaintenance ? "border-green-500" : ""}>
                    {state.data.needsMaintenance ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                    <AlertTitle className={!state.data.needsMaintenance ? "text-green-700" : ""}>
                        {state.data.needsMaintenance ? 'Entretien recommandé' : 'Aucun entretien immédiat nécessaire'}
                    </AlertTitle>
                    <AlertDescription className="space-y-2">
                       <p>{state.data.reason}</p>
                       {state.data.needsMaintenance && (
                        <>
                           <p className='font-semibold'>Tâches suggérées: <span className='font-normal'>{state.data.suggestedMaintenanceTasks}</span></p>
                           <div className='flex items-center gap-2'>
                                <Badge variant={state.data.urgency === 'high' ? 'destructive' : 'secondary'}>Urgence: {state.data.urgency}</Badge>
                                <Badge variant="outline">Coût est.: {formatCurrency(state.data.estimatedCost, 'MAD')}</Badge>
                           </div>
                        </>
                       )}
                    </AlertDescription>
                </Alert>
            )}

            {state.message && state.message !== 'Success' && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreur</AlertTitle>
                    <AlertDescription>
                        {state.message}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
