"use client";

import { useState } from "react";
import Image, { ImageProps } from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
    fallbackIcon?: React.ReactNode;
    containerClassName?: string;
}

export function OptimizedImage({
    src,
    alt,
    className,
    containerClassName,
    fallbackIcon,
    ...props
}: OptimizedImageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    const handleLoad = () => {
        setIsLoading(false);
    };

    const handleError = () => {
        setIsLoading(false);
        setError(true);
    };

    return (
        <div className={cn("relative overflow-hidden bg-muted/20", containerClassName)}>
            <AnimatePresence mode="wait">
                {isLoading && (
                    <motion.div
                        key="skeleton"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10"
                    >
                        <Skeleton className="h-full w-full rounded-none" />
                    </motion.div>
                )}

                {error ? (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground p-4 text-center"
                    >
                        {fallbackIcon || <ImageIcon className="h-10 w-10 mb-2 opacity-20" />}
                        <div className="flex items-center gap-1.5 text-xs font-medium opacity-50">
                            <AlertCircle className="h-3 w-3" />
                            <span>Failed to load image</span>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="image"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isLoading ? 0 : 1 }}
                        transition={{ duration: 0.4 }}
                        className="h-full w-full"
                    >
                        <Image
                            src={src}
                            alt={alt}
                            className={cn(
                                "object-cover transition-transform duration-500",
                                isLoading ? "scale-110 blur-sm" : "scale-100 blur-0",
                                className
                            )}
                            onLoad={handleLoad}
                            onError={handleError}
                            {...props}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
