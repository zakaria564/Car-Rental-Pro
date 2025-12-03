
"use client";
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { checkMaintenance, type MaintenanceState } from '@/lib/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full bg-primary hover:bg-primary/90">
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}
            Predict Maintenance
        </Button>
    );
}

export default function MaintenanceChecker({ carId }: { carId: string }) {
    const initialState: MaintenanceState = { message: null, errors: {} };
    const [state, dispatch] = useFormState(checkMaintenance, initialState);

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Use our AI-powered tool to predict if this car needs maintenance based on its recent usage and history.
            </p>
            <form action={dispatch} className="space-y-4">
                <input type="hidden" name="carId" value={carId} />
                <div className="space-y-2">
                    <Label htmlFor="usageData">Recent Usage Data</Label>
                    <Textarea
                        id="usageData"
                        name="usageData"
                        placeholder="e.g., 'Driven 2000 miles in the last month, mostly city driving. Some hard braking.''"
                        required
                    />
                    {state.errors?.usageData && <p className="text-sm font-medium text-destructive">{state.errors.usageData[0]}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="historicalMaintenanceData">Historical Maintenance Data</Label>
                    <Textarea
                        id="historicalMaintenanceData"
                        name="historicalMaintenanceData"
                        placeholder="e.g., 'Last oil change 6 months ago. Brake pads replaced 1 year ago.'"
                        required
                    />
                     {state.errors?.historicalMaintenanceData && <p className="text-sm font-medium text-destructive">{state.errors.historicalMaintenanceData[0]}</p>}
                </div>
                <SubmitButton />
            </form>

            {state.message === 'Success' && state.data && (
                <Alert variant={state.data.needsMaintenance ? 'destructive' : 'default'} className={!state.data.needsMaintenance ? "border-green-500" : ""}>
                    {state.data.needsMaintenance ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                    <AlertTitle className={!state.data.needsMaintenance ? "text-green-700" : ""}>
                        {state.data.needsMaintenance ? 'Maintenance Recommended' : 'No Immediate Maintenance Needed'}
                    </AlertTitle>
                    <AlertDescription className="space-y-2">
                       <p>{state.data.reason}</p>
                       {state.data.needsMaintenance && (
                        <>
                           <p className='font-semibold'>Suggested Tasks: <span className='font-normal'>{state.data.suggestedMaintenanceTasks}</span></p>
                           <div className='flex items-center gap-2'>
                                <Badge variant={state.data.urgency === 'high' ? 'destructive' : 'secondary'}>Urgency: {state.data.urgency}</Badge>
                                <Badge variant="outline">Est. Cost: {formatCurrency(state.data.estimatedCost)}</Badge>
                           </div>
                        </>
                       )}
                    </AlertDescription>
                </Alert>
            )}

            {state.message && state.message !== 'Success' && (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {state.message}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
