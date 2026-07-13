'use client';

import * as React from 'react';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

function getElementText(node: React.ReactNode): string {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getElementText).join('');
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return getElementText(element.props.children);
  }
  return '';
}

const TabsContext = React.createContext<{
  value?: string;
  onValueChange?: (val: string, event?: any) => void;
  defaultValue?: string;
  triggers: { value: string; label: string }[];
  registerTrigger: (value: string, label: string) => void;
  unregisterTrigger: (value: string) => void;
} | null>(null);

function Tabs({
  className,
  orientation = 'horizontal',
  value: controlledValue,
  onValueChange,
  defaultValue,
  ...props
}: TabsPrimitive.Root.Props) {
  const [localValue, setLocalValue] = React.useState(defaultValue || '');
  const activeValue = controlledValue !== undefined ? controlledValue : localValue;

  const handleValueChange = React.useCallback(
    (val: string, event?: any) => {
      if (controlledValue === undefined) {
        setLocalValue(val);
      }
      onValueChange?.(val, event);
    },
    [controlledValue, onValueChange],
  );

  const [triggers, setTriggers] = React.useState<{ value: string; label: string }[]>([]);

  const registerTrigger = React.useCallback((val: string, label: string) => {
    setTriggers((prev) => {
      if (prev.some((t) => t.value === val)) {
        return prev.map((t) => (t.value === val ? { value: val, label } : t));
      }
      return [...prev, { value: val, label }];
    });
  }, []);

  const unregisterTrigger = React.useCallback((val: string) => {
    setTriggers((prev) => prev.filter((t) => t.value !== val));
  }, []);

  const contextValue = React.useMemo(
    () => ({
      value: activeValue,
      onValueChange: handleValueChange,
      defaultValue,
      triggers,
      registerTrigger,
      unregisterTrigger,
    }),
    [activeValue, handleValueChange, defaultValue, triggers, registerTrigger, unregisterTrigger],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        value={activeValue}
        onValueChange={handleValueChange}
        className={cn('group/tabs flex gap-2 data-horizontal:flex-col', className)}
        {...props}
      />
    </TabsContext.Provider>
  );
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const ctx = React.useContext(TabsContext);

  return (
    <>
      {ctx && ctx.triggers.length > 0 && (
        <div className="mb-4 block w-full sm:hidden">
          <select
            value={ctx.value || ctx.defaultValue || ''}
            onChange={(e) => ctx.onValueChange?.(e.target.value)}
            className="border-input bg-background text-foreground focus:ring-ring h-11 w-full rounded-lg border px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            {ctx.triggers.map((trigger) => (
              <option key={trigger.value} value={trigger.value}>
                {trigger.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), 'hidden sm:inline-flex', className)}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </>
  );
}

function TabsTrigger({ className, value, children, ...props }: TabsPrimitive.Tab.Props) {
  const ctx = React.useContext(TabsContext);
  const textLabel = React.useMemo(() => getElementText(children), [children]);
  const { registerTrigger, unregisterTrigger } = ctx ?? {};

  React.useEffect(() => {
    if (registerTrigger && unregisterTrigger && value) {
      registerTrigger(value, textLabel);
      return () => unregisterTrigger(value);
    }
  }, [registerTrigger, unregisterTrigger, value, textLabel]);

  return (
    <TabsPrimitive.Tab
      value={value}
      data-slot="tabs-trigger"
      className={cn(
        "text-foreground/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
        'data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground',
        'after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Tab>
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
