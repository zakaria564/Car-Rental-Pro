
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
import { toast } from "@/hooks/use-toast";
import type { Rental } from "@/lib/definitions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "../ui/calendar";
import { cn, formatCurrency } from "@/lib/utils";
import { format, differenceInCalendarDays } from "date-fns";
import { MOCK_CARS, MOCK_CLIENTS } from "@/lib/mock-data";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const rentalFormSchema = z.object({
  clientId: z.string({ required_error: "Please select a client." }),
  voitureId: z.string({ required_error: "Please select a car." }),
  dateRange: z.object({
    from: z.date({ required_error: "A start date is required." }),
    to: z.date({ required_error: "An end date is required." }),
  }),
  caution: z.coerce.number().min(0, "Deposit cannot be negative."),
});

type RentalFormValues = z.infer<typeof rentalFormSchema>;

export default function RentalForm({ rental, onFinished }: { rental: Rental | null, onFinished: () => void }) {
  
  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    mode: "onChange",
  });
  
  const selectedCarId = form.watch("voitureId");
  const dateRange = form.watch("dateRange");

  const availableCars = MOCK_CARS.filter(car => car.disponible);

  const selectedCar = React.useMemo(() => {
    return MOCK_CARS.find(car => car.id === selectedCarId);
  }, [selectedCarId]);

  const rentalDays = React.useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
        return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    }
    return 0;
  }, [dateRange]);

  const prixTotal = React.useMemo(() => {
    if (selectedCar && rentalDays > 0) {
        return selectedCar.prixParJour * rentalDays;
    }
    return 0;
  }, [selectedCar, rentalDays]);

  function onSubmit(data: RentalFormValues) {
    toast({
      title: "Rental Created",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify({...data, prixTotal}, null, 2)}</code>
        </pre>
      ),
    });
    onFinished();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
        <FormField
          control={form.control}
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MOCK_CLIENTS.map(client => <SelectItem key={client.id} value={client.id}>{client.nom}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="voitureId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Car</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select an available car" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableCars.map(car => <SelectItem key={car.id} value={car.id}>{car.marque} {car.modele}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dateRange"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Rental Period</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn("w-full pl-3 text-left font-normal", !field.value?.from && "text-muted-foreground")}
                    >
                      {field.value?.from ? (
                        field.value.to ? (
                          <>
                            {format(field.value.from, "LLL dd, y")} -{" "}
                            {format(field.value.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(field.value.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={field.value?.from}
                    selected={{from: field.value?.from, to: field.value?.to}}
                    onSelect={field.onChange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="caution"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Security Deposit ($)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="500" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Card className="bg-muted/50">
            <CardHeader>
                <CardTitle className="text-lg">Rental Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Price per day:</span> <span className="font-medium">{selectedCar ? formatCurrency(selectedCar.prixParJour) : '$0.00'}</span></div>
                <div className="flex justify-between"><span>Rental duration:</span> <span className="font-medium">{rentalDays} day(s)</span></div>
                <div className="flex justify-between text-lg font-bold"><span>Total Price:</span> <span>{formatCurrency(prixTotal)}</span></div>
            </CardContent>
        </Card>

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={!form.formState.isValid}>
          Create Rental
        </Button>
      </form>
    </Form>
  );
}
