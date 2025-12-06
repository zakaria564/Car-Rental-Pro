
"use client";

import * as React from "react";
import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "./input";
import { useFormContext } from "react-hook-form";

// This component is designed to be used with react-hook-form.
// It uses a render prop pattern for the label to allow associating it
// with the input element, which is necessary for the form library to work correctly.

const PhotoFormField = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ name, ...props }, ref) => {
    if (!name) {
        console.error("PhotoFormField requires a name prop");
        return null;
    }
    const { register } = useFormContext();
    return (
        <Input type="file" accept="image/*" {...register(name)} {...props} />
    )
});
PhotoFormField.displayName = "PhotoFormField";


export { PhotoFormField };
