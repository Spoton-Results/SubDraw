import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type ProjectSectionProps = {
  title: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
};

export function ProjectSection({
  title,
  icon,
  defaultOpen = false,
  actions,
  description,
  children,
  className,
  contentClassName,
  titleClassName,
}: ProjectSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CollapsibleTrigger className="flex items-center gap-2 text-left">
              {open ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
              <CardTitle className={cn("flex items-center gap-2", titleClassName)}>
                {icon}
                {title}
              </CardTitle>
            </CollapsibleTrigger>
            {actions}
          </div>
          {open && description}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className={contentClassName}>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
