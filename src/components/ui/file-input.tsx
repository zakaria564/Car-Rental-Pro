
"use client";

import * as React from "react";
import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";

const FileInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
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
        htmlFor="file-upload"
        className={cn(
          "flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        <Upload className="h-4 w-4" />
        <span>{fileName || "Choose a file"}</span>
      </label>
      <input
        id="file-upload"
        type="file"
        className="sr-only"
        ref={ref}
        {...props}
        onChange={handleFileChange}
      />
    </div>
  );
});

FileInput.displayName = "FileInput";

export { FileInput };
