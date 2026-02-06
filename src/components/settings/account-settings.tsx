
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase } from '@/firebase';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const profileFormSchema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères."),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Le mot de passe actuel est requis."),
  newPassword: z.string().min(6, "Le nouveau mot de passe doit comporter au moins 6 caractères."),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Les nouveaux mots de passe ne correspondent pas.",
  path: ['confirmPassword'],
});

export function AccountSettings() {
  const { auth } = useFirebase();
  const { toast } = useToast();
  const [isProfileSubmitting, setIsProfileSubmitting] = React.useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = React.useState(false);

  const currentUser = auth.currentUser;
  
  const isEmailProvider = currentUser?.providerData.some(
    (provider) => provider.providerId === 'password'
  );

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: currentUser?.displayName || '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onProfileSubmit(data: z.infer<typeof profileFormSchema>) {
    if (!currentUser) return;
    setIsProfileSubmitting(true);
    try {
      await updateProfile(currentUser, { displayName: data.name });
      toast({
        title: "Profil mis à jour",
        description: "Votre nom a été mis à jour avec succès.",
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Erreur",
        description: error.message,
      });
    } finally {
      setIsProfileSubmitting(false);
    }
  }

  async function onPasswordSubmit(data: z.infer<typeof passwordFormSchema>) {
    if (!currentUser || !currentUser.email) return;
    setIsPasswordSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, data.currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, data.newPassword);
      
      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été changé avec succès.",
      });
      passwordForm.reset();
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: "Erreur lors de la modification du mot de passe",
        description: "Le mot de passe actuel est incorrect ou une autre erreur est survenue.",
      });
    } finally {
      setIsPasswordSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mon Compte</CardTitle>
        <CardDescription>
          Mettez à jour les informations de votre profil et votre mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Profile Form */}
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom complet</FormLabel>
                  <FormControl>
                    <Input placeholder="Jean Dupont" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormItem>
              <FormLabel>Email</FormLabel>
              <Input type="email" value={currentUser?.email || ''} readOnly disabled />
              <FormDescription>L'adresse email ne peut pas être modifiée.</FormDescription>
            </FormItem>
            <Button type="submit" disabled={isProfileSubmitting}>
              {isProfileSubmitting ? 'Enregistrement...' : 'Enregistrer le nom'}
            </Button>
          </form>
        </Form>

        {isEmailProvider && (
          <>
            <Separator />
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <h3 className="text-lg font-medium">Changer le mot de passe</h3>
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe actuel</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nouveau mot de passe</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPasswordSubmitting}>
                  {isPasswordSubmitting ? 'Modification...' : 'Changer le mot de passe'}
                </Button>
              </form>
            </Form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
