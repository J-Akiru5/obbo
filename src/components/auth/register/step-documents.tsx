"use client";

import { Upload, X, FileCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepDocumentsProps {
    files: {
        valid_id_front_file: File | null;
        valid_id_back_file: File | null;
        business_permit_file: File | null;
    };
    onFilesChange: (files: Partial<{ 
        valid_id_front_file: File | null; 
        valid_id_back_file: File | null; 
        business_permit_file: File | null; 
    }>) => void;
    errors: Record<string, string>;
    accountType: "individual" | "company";
}

function FileDropZone({
    label,
    file,
    onFileChange,
    error,
    inputId,
}: {
    label: string;
    file: File | null;
    onFileChange: (f: File | null) => void;
    error?: string;
    inputId: string;
}) {
    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
                {label} <span className="text-destructive">*</span>
            </p>
            {file ? (
                <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                    <FileCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-emerald-800 truncate">{file.name}</p>
                        <p className="text-xs text-emerald-600">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => onFileChange(null)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            ) : (
                <div
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => document.getElementById(inputId)?.click()}
                >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, PDF &middot; max 10MB</p>
                    <input
                        id={inputId}
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                    />
                </div>
            )}
            {error && (
                <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                </p>
            )}
        </div>
    );
}

export function StepDocuments({
    files,
    onFilesChange,
    errors,
    accountType,
}: StepDocumentsProps) {
    return (
        <div className="space-y-5">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    Document upload
                </h2>
                <p className="text-sm text-muted-foreground">
                    {accountType === "company"
                        ? "Upload the contact person's valid ID (front & back views) and your business permit."
                        : "Upload photos of the front and back views of your valid government-issued ID."}
                </p>
            </div>

            {/* 🌟 SPLIT SCREEN CONTAINER ROW: Front and Back Views side-by-side deployment layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileDropZone
                    label={accountType === "company" ? "Contact Person ID (Front)" : "Valid ID (Front View)"}
                    file={files.valid_id_front_file}
                    onFileChange={(f) => onFilesChange({ valid_id_front_file: f })}
                    error={errors.valid_id_front_file}
                    inputId="valid-id-front-upload"
                />

                <FileDropZone
                    label={accountType === "company" ? "Contact Person ID (Back)" : "Valid ID (Back View)"}
                    file={files.valid_id_back_file}
                    onFileChange={(f) => onFilesChange({ valid_id_back_file: f })}
                    error={errors.valid_id_back_file}
                    inputId="valid-id-back-upload"
                />
            </div>

            {accountType === "company" && (
                <div className="border-t pt-4">
                    <FileDropZone
                        label="Business permit"
                        file={files.business_permit_file}
                        onFileChange={(f) => onFilesChange({ business_permit_file: f })}
                        error={errors.business_permit_file}
                        inputId="business-permit-upload"
                    />
                </div>
            )}
        </div>
    );
}