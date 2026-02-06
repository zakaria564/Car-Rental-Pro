'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { doc, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Image from 'next/image';

const companySettingsSchema = z.object({
  companyName: z.string().min(2, "Le nom de l'agence est requis."),
  logoUrl: z.string().url("Veuillez entrer une URL valide.").or(z.literal('')).optional(),
});

type CompanySettingsValues = z.infer<typeof companySettingsSchema>;

export function CompanySettings() {
  const { firestore, companySettings } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CompanySettingsValues>({
    resolver: zodResolver(companySettingsSchema),
    values: {
        companyName: companySettings?.companyName || 'Location Auto Pro',
        logoUrl: companySettings?.logoUrl || '',
    }
  });

  const logoUrlValue = form.watch('logoUrl');

  async function onSubmit(data: CompanySettingsValues) {
    if (!firestore) return;
    setIsSubmitting(true);
    
    const settingsRef = doc(firestore, 'settings', 'company');

    try {
        await setDoc(settingsRef, data, { merge: true });
        toast({
            title: "Paramètres de l'agence mis à jour",
            description: "Le nom et le logo de votre agence ont été sauvegardés.",
        });
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: settingsRef.path,
            operation: 'update',
            requestResourceData: data,
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: 'destructive',
            title: "Erreur",
            description: "Impossible de sauvegarder les paramètres. Vérifiez vos permissions.",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agence</CardTitle>
        <CardDescription>
          Gérez le nom et le logo de votre agence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l'agence</FormLabel>
                  <FormControl>
                    <Input placeholder="Location Auto Pro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL du logo</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="https://exemple.com/logo.png" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {logoUrlValue && (
                <div className="relative w-32 h-32 rounded-md overflow-hidden border bg-muted my-2">
                    <Image src={logoUrlValue} alt="Aperçu du logo" fill className="object-contain" />
                </div>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer les informations'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
