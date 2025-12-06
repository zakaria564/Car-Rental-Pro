
"use client";

import * as React from "react";
import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";

// This component is designed to be used with react-hook-form.
// It uses a render prop pattern for the label to allow associating it
// with the input element, which is necessary for the form library to work correctly.
// The input itself is hidden and controlled by the form library.

type FileInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  renderLabel: (props: { htmlFor: string }) => React.ReactNode;
};

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, renderLabel, ...props }, ref) => {
    const id = React.useId();

    return (
      <>
        {renderLabel({ htmlFor: id })}
        <input
          id={id}
          type="file"
          accept="image/*"
          className={cn("sr-only", className)}
          ref={ref}
          {...props}
        />
      </>
    );
  }
);
FileInput.displayName = "FileInput";


const FileInputLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { fileName?: string | null; }
>(({ className, fileName, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      <Upload className="h-4 w-4" />
      <span>{fileName || "Choisir un fichier"}</span>
    </label>
  );
});
FileInputLabel.displayName = "FileInputLabel";


// Simplified CarForm-specific file field
const PhotoFormField = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => {
  const id = React.useId();
  const [fileName, setFileName] = React.useState<string | null>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileName(file ? file.name : null);
    // Forward the event to the original onChange handler if it exists
    props.onChange?.(event);
  };

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={cn(
          "flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        <Upload className="h-4 w-4" />
        <span>{fileName || "Choisir un fichier"}</span>
      </label>
      <input
        id={id}
        type="file"
        ref={ref}
        className="sr-only"
        accept="image/*"
        {...props}
        onChange={handleFileChange}
      />
    </div>
  );
});
PhotoFormField.displayName = "PhotoFormField";


export { FileInput, FileInputLabel, PhotoFormField };

